import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicOrderResponse } from '../orders/orders.service';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_TIMEOUT_MS = 7_000;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async notifyNewOrder(order: PublicOrderResponse): Promise<void> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const senderEmail = this.config.get<string>('BREVO_SENDER_EMAIL');
    const recipientEmail = this.config.get<string>('ORDER_NOTIFICATION_EMAIL');
    if (!apiKey || !senderEmail || !recipientEmail) {
      this.logger.warn(
        'Brevo notification skipped: email configuration is incomplete',
      );
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
    try {
      const response = await fetch(BREVO_ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(this.message(order, senderEmail, recipientEmail)),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Brevo returned HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `Brevo notification failed for order ${order.reference}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private message(
    order: PublicOrderResponse,
    senderEmail: string,
    recipientEmail: string,
  ) {
    const senderName = this.config.get<string>(
      'BREVO_SENDER_NAME',
      'La Maison des Montres',
    );
    const lines = order.items.map(
      (item) =>
        `${item.quantity} × ${item.name} (${item.reference}) — ${formatTnd(item.lineMillimes)}`,
    );
    const text = [
      `Nouvelle commande ${order.reference}`,
      '',
      `Client : ${order.shipping.firstName} ${order.shipping.lastName}`,
      `Téléphone : ${order.shipping.phone}`,
      `Livraison : ${order.shipping.governorate} — ${order.shipping.city}`,
      `Adresse : ${order.shipping.address}`,
      '',
      'Articles :',
      ...lines,
      '',
      `Sous-total : ${formatTnd(order.totals.subtotalMillimes)}`,
      `Livraison : ${formatTnd(order.totals.shippingMillimes)}`,
      `Total : ${formatTnd(order.totals.totalMillimes)}`,
      `Paiement : ${order.paymentMethod.toUpperCase()}`,
    ].join('\n');
    const htmlLines = lines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('');
    const html = `
      <h1>Nouvelle commande ${escapeHtml(order.reference)}</h1>
      <p><strong>Client :</strong> ${escapeHtml(order.shipping.firstName)} ${escapeHtml(order.shipping.lastName)}</p>
      <p><strong>Téléphone :</strong> ${escapeHtml(order.shipping.phone)}</p>
      <p><strong>Livraison :</strong> ${escapeHtml(order.shipping.governorate)} — ${escapeHtml(order.shipping.city)}</p>
      <p><strong>Adresse :</strong> ${escapeHtml(order.shipping.address)}</p>
      <h2>Articles</h2>
      <ul>${htmlLines}</ul>
      <p><strong>Sous-total :</strong> ${escapeHtml(formatTnd(order.totals.subtotalMillimes))}<br />
      <strong>Livraison :</strong> ${escapeHtml(formatTnd(order.totals.shippingMillimes))}<br />
      <strong>Total :</strong> ${escapeHtml(formatTnd(order.totals.totalMillimes))}</p>
      <p><strong>Paiement :</strong> ${escapeHtml(order.paymentMethod.toUpperCase())}</p>
    `;
    return {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: recipientEmail }],
      subject: `Nouvelle commande ${order.reference}`,
      textContent: text,
      htmlContent: html,
    };
  }
}

function formatTnd(millimes: number): string {
  return `${(millimes / 1000).toFixed(3)} TND`;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      })[character] ?? character,
  );
}
