import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { PublicOrderResponse } from '../orders/orders.service';
import { MetaConversionsService } from './meta-conversions.service';

const order = {
  id: 'c1d6d8d2-89a7-4a2a-9d18-88ed8d01d9d2',
  reference: 'LMM-20260917-TEST1234',
  createdAt: '2026-09-17T10:00:00.000Z',
  status: 'new',
  paymentMethod: 'cod',
  currency: 'TND',
  shippingLabel: 'Tunis — Tunis',
  shipping: {
    firstName: 'Amine',
    lastName: 'Test',
    phone: '+21620123456',
    email: 'amine@example.com',
    governorate: 'Tunis',
    city: 'Tunis',
    address: '1 rue Test',
    postalCode: '1000',
    note: null,
  },
  items: [
    {
      productId: 'a1d6d8d2-89a7-4a2a-9d18-88ed8d01d9d2',
      name: 'Produit test',
      brand: 'Marque test',
      reference: 'TEST-001',
      slug: 'produit-test',
      imageUrl: null,
      imageAlt: 'Produit test',
      quantity: 1,
      unitMillimes: 125_000,
      lineMillimes: 125_000,
    },
  ],
  totals: {
    subtotalMillimes: 125_000,
    shippingMillimes: 8_000,
    totalMillimes: 133_000,
    itemCount: 1,
  },
} satisfies PublicOrderResponse;

describe('MetaConversionsService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events_received: 1 }),
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fails open when the CAPI access token is not configured', async () => {
    const service = new MetaConversionsService(new ConfigService({}));

    await service.sendPurchase(order);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends a deduplicable Purchase event with hashed customer data', async () => {
    const service = new MetaConversionsService(
      new ConfigService({
        META_CONVERSIONS_API_ACCESS_TOKEN: 'a'.repeat(40),
        META_PIXEL_ID: '1659246991836575',
        META_CONVERSIONS_API_VERSION: 'v22.0',
        PUBLIC_SITE_URL: 'https://lamaisondesmontres.com',
      }),
    );

    await service.sendPurchase(order);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toContain(
      'https://graph.facebook.com/v22.0/1659246991836575/events',
    );
    expect(url).toContain('access_token=');
    const payload = JSON.parse(String(init.body)) as {
      data: Array<{
        event_id: string;
        user_data: { em: string[]; ph: string[] };
        custom_data: { content_ids: string[]; value: number };
      }>;
    };
    expect(payload.data[0].event_id).toBe(order.reference);
    expect(payload.data[0].custom_data.content_ids).toEqual([
      order.items[0].productId,
    ]);
    expect(payload.data[0].custom_data.value).toBe(133);
    expect(payload.data[0].user_data.em[0]).toHaveLength(64);
    expect(payload.data[0].user_data.ph[0]).toHaveLength(64);
  });

  it('relays browser event identifiers and first-party Meta cookies', async () => {
    const service = new MetaConversionsService(
      new ConfigService({ META_CONVERSIONS_API_ACCESS_TOKEN: 'a'.repeat(40) }),
    );
    const request = {
      headers: { 'x-forwarded-for': '192.0.2.10, 10.0.0.1' },
      ip: '10.0.0.1',
      get: () => 'Mozilla/5.0',
    } as unknown as Request;

    await service.relay(
      {
        eventName: 'ViewContent',
        eventId: 'lmm-viewcontent-test-1234',
        eventSourceUrl: 'https://lamaisondesmontres.com/produits/test',
        contentIds: [order.items[0].productId],
        contentName: 'Produit test',
        contentType: 'product',
        value: 125,
        currency: 'TND',
        fbp: 'fb.1.123.456',
        fbc: 'fb.1.123.click',
      },
      request,
    );

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const payload = JSON.parse(String(init.body)) as {
      data: Array<{
        event_id: string;
        user_data: Record<string, string | string[]>;
      }>;
    };
    expect(payload.data[0].event_id).toBe('lmm-viewcontent-test-1234');
    expect(payload.data[0].user_data.fbp).toBe('fb.1.123.456');
    expect(payload.data[0].user_data.fbc).toBe('fb.1.123.click');
    expect(payload.data[0].user_data.client_ip_address).toBe('192.0.2.10');
    expect(payload.data[0].user_data.client_user_agent).toBe('Mozilla/5.0');
  });
});
