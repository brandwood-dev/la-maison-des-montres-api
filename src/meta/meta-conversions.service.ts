import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { PublicOrderResponse } from '../orders/orders.service';
import type { MetaEventDto, MetaRelayableEvent } from './meta-conversions.dto';

const META_API_TIMEOUT_MS = 4_000;

type MetaContent = {
  id: string;
  quantity: number;
  item_price?: number;
};

type MetaEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: 'website';
  event_source_url: string;
  user_data: Record<string, string | string[]>;
  custom_data?: Record<string, unknown>;
};

type MetaResponse = {
  events_received?: number;
  messages?: string[];
  error?: { message?: string; code?: number };
};

@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Sends the authoritative Purchase event after an order is persisted.
   * The order reference is reused as event_id so the browser Purchase event
   * and this server event are deduplicated by Meta.
   */
  async sendPurchase(order: PublicOrderResponse): Promise<void> {
    const email = order.shipping.email ?? undefined;
    const phone = order.shipping.phone;
    const event: MetaEvent = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1_000),
      event_id: order.reference,
      action_source: 'website',
      event_source_url: this.siteUrl('/commande/confirmation'),
      user_data: this.userData({ email, phone }),
      custom_data: {
        currency: order.currency,
        value: order.totals.totalMillimes / 1_000,
        content_type: 'product',
        content_ids: order.items.map((item) => item.productId),
        contents: order.items.map(
          (item) =>
            ({
              id: item.productId,
              quantity: item.quantity,
              item_price: item.unitMillimes / 1_000,
            }) satisfies MetaContent,
        ),
        num_items: order.totals.itemCount,
        order_id: order.reference,
      },
    };

    await this.send([event]);
  }

  /** Relays non-purchase browser events with the same event_id as fbq. */
  async relay(input: MetaEventDto, request: Request): Promise<void> {
    const eventName: MetaRelayableEvent = input.eventName;
    const event: MetaEvent = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1_000),
      event_id: input.eventId,
      action_source: 'website',
      event_source_url: input.eventSourceUrl ?? this.siteUrl(),
      user_data: this.userData({
        fbp: input.fbp,
        fbc: input.fbc,
        clientIp: this.clientIp(request),
        userAgent: request.get('user-agent') ?? undefined,
      }),
      custom_data: this.customData(input),
    };

    await this.send([event]);
  }

  private customData(input: MetaEventDto): Record<string, unknown> | undefined {
    const customData: Record<string, unknown> = {};
    if (input.contentIds?.length) customData.content_ids = input.contentIds;
    if (input.contents?.length) {
      customData.contents = input.contents.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        ...(item.itemPrice === undefined ? {} : { item_price: item.itemPrice }),
      }));
    }
    if (input.contentName) customData.content_name = input.contentName;
    if (input.contentType) customData.content_type = input.contentType;
    if (input.value !== undefined) customData.value = input.value;
    if (input.currency) customData.currency = input.currency;
    if (input.numItems !== undefined) customData.num_items = input.numItems;
    return Object.keys(customData).length > 0 ? customData : undefined;
  }

  private userData(input: {
    email?: string;
    phone?: string;
    fbp?: string;
    fbc?: string;
    clientIp?: string;
    userAgent?: string;
    [key: string]: unknown;
  }): Record<string, string | string[]> {
    const data: Record<string, string | string[]> = {};
    if (input.email?.trim()) data.em = [this.hash(input.email)];
    if (input.phone?.trim()) {
      // Meta expects an E.164 phone without punctuation before hashing.
      data.ph = [this.hash(input.phone.replace(/\D/g, ''))];
    }
    if (input.fbp?.trim()) data.fbp = input.fbp.trim();
    if (input.fbc?.trim()) data.fbc = input.fbc.trim();
    if (input.clientIp?.trim()) data.client_ip_address = input.clientIp.trim();
    if (input.userAgent?.trim())
      data.client_user_agent = input.userAgent.trim();
    return data;
  }

  private clientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = value?.split(',')[0]?.trim();
    return first || request.ip || undefined;
  }

  private hash(value: string): string {
    return createHash('sha256')
      .update(value.trim().toLowerCase())
      .digest('hex');
  }

  private siteUrl(path = ''): string {
    const base = (
      this.config.get<string>('PUBLIC_SITE_URL') ??
      'https://lamaisondesmontres.com'
    ).replace(/\/+$/, '');
    return `${base}${path}`;
  }

  private async send(events: MetaEvent[]): Promise<void> {
    const credentials = this.credentials();
    if (!credentials) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), META_API_TIMEOUT_MS);
    try {
      const response = await fetch(
        `https://graph.facebook.com/${credentials.version}/${credentials.pixelId}/events?access_token=${encodeURIComponent(credentials.accessToken)}`,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ data: events }),
          signal: controller.signal,
        },
      );
      const payload = (await response.json().catch(() => ({}))) as MetaResponse;
      if (!response.ok || payload.error) {
        this.logger.warn(
          `Meta Conversions API rejected event batch (HTTP ${response.status})`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Meta Conversions API unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private credentials(): {
    pixelId: string;
    accessToken: string;
    version: string;
  } | null {
    const accessToken = this.config.get<string>(
      'META_CONVERSIONS_API_ACCESS_TOKEN',
    );
    if (!accessToken?.trim()) return null;

    return {
      pixelId: this.config.get<string>('META_PIXEL_ID') ?? '1659246991836575',
      accessToken: accessToken.trim(),
      version:
        this.config.get<string>('META_CONVERSIONS_API_VERSION') ?? 'v22.0',
    };
  }
}
