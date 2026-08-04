import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicOrderResponse } from '../orders/orders.service';

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_TIMEOUT_MS = 7_000;

export interface TeamInvitationEmail {
  email: string;
  firstName: string;
  role: string;
  token: string;
  message?: string;
}

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

  async sendTeamInvitation(input: TeamInvitationEmail): Promise<void> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    const senderEmail = this.config.get<string>('BREVO_SENDER_EMAIL');
    if (!apiKey || !senderEmail) {
      throw new Error('Brevo invitation configuration is incomplete');
    }

    const adminUrl = this.config
      .getOrThrow<string>('ADMIN_PUBLIC_URL')
      .replace(/\/+$/, '');
    const invitationUrl = `${adminUrl}/invite/${encodeURIComponent(input.token)}`;
    const senderName = this.config.get<string>(
      'BREVO_SENDER_NAME',
      'La Maison des Montres',
    );
    const role = escapeHtml(input.role);
    const firstName = escapeHtml(input.firstName);
    const customMessage = input.message?.trim();
    const textContent = [
      `Bonjour ${input.firstName},`,
      '',
      `Vous êtes invité(e) à rejoindre l'administration de La Maison des Montres (${input.role}).`,
      customMessage ? `Message : ${customMessage}` : '',
      '',
      `Configurez votre mot de passe dans les 24 heures : ${invitationUrl}`,
      '',
      'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.',
    ]
      .filter(Boolean)
      .join('\n');
    const htmlContent = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#f4f3ed;color:#1c1b1b;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #eae8e0;border-radius:14px;overflow:hidden;"><tr><td style="height:5px;background:#c89d54;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="padding:28px"><p style="margin:0 0 8px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#6b6a68">La Maison des Montres</p><h1 style="margin:0 0 16px;font-size:24px">Invitation administrateur</h1><p>Bonjour <strong>${firstName}</strong>,</p><p>Vous êtes invité(e) à rejoindre l’administration avec le rôle <strong>${role}</strong>.</p>${customMessage ? `<p style="padding:12px;background:#f4f3ed;border-radius:8px">${escapeHtml(customMessage)}</p>` : ''}<p style="margin:24px 0"><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;padding:12px 18px;background:#1c1b1b;color:#fff;text-decoration:none;border-radius:8px">Créer mon accès</a></p><p style="font-size:13px;color:#6b6a68">Ce lien expire dans 24 heures et ne peut être utilisé qu’une seule fois.</p></td></tr><tr><td style="padding:14px 28px;background:#1c1b1b;color:#fff;font-size:12px">Notification automatique · La Maison des Montres</td></tr></table></body></html>`;

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
        body: JSON.stringify({
          sender: { email: senderEmail, name: senderName },
          to: [{ email: input.email }],
          subject: 'Invitation à rejoindre La Maison des Montres',
          textContent,
          htmlContent,
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`Brevo returned HTTP ${response.status}`);
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
    const customerName = `${order.shipping.firstName} ${order.shipping.lastName}`;
    const customerEmail = order.shipping.email ?? 'Non renseigné';
    const postalCode = order.shipping.postalCode ?? 'Non renseigné';
    const note = order.shipping.note ?? 'Aucune';
    const itemLines = order.items.map(
      (item) =>
        `${item.quantity} × ${item.name} (${item.reference}) — ${formatTnd(item.lineMillimes)}`,
    );
    const text = [
      `Nouvelle commande ${order.reference}`,
      `Date : ${formatDate(order.createdAt)}`,
      '',
      `Client : ${customerName}`,
      `Téléphone : ${order.shipping.phone}`,
      `E-mail : ${customerEmail}`,
      `Gouvernorat : ${order.shipping.governorate}`,
      `Ville / délégation : ${order.shipping.city}`,
      `Adresse : ${order.shipping.address}`,
      `Code postal : ${postalCode}`,
      `Note de livraison : ${note}`,
      '',
      'Articles :',
      ...itemLines,
      '',
      `Sous-total : ${formatTnd(order.totals.subtotalMillimes)}`,
      `Livraison : ${formatTnd(order.totals.shippingMillimes)}`,
      `Total : ${formatTnd(order.totals.totalMillimes)}`,
      `Paiement : ${order.paymentMethod.toUpperCase()}`,
    ].join('\n');
    const itemRows = order.items.map((item) => this.itemRow(item)).join('');
    const html = this.html(
      order,
      customerName,
      customerEmail,
      postalCode,
      note,
      itemRows,
    );

    return {
      sender: { email: senderEmail, name: senderName },
      to: [{ email: recipientEmail }],
      subject: `Nouvelle commande ${order.reference}`,
      textContent: text,
      htmlContent: html,
    };
  }

  private itemRow(item: PublicOrderResponse['items'][number]): string {
    const imageUrl = safeImageUrl(item.imageUrl);
    const image = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.imageAlt)}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #eae8e0;" />`
      : '<span style="display:block;width:64px;height:64px;border-radius:8px;background:#f4f3ed;border:1px solid #eae8e0;"></span>';
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e0;vertical-align:middle;">${image}</td>
      <td style="padding:12px;border-bottom:1px solid #eae8e0;vertical-align:middle;color:#1c1b1b;"><strong style="font-size:14px;">${escapeHtml(item.name)}</strong><br /><span style="font-size:12px;color:#6b6a68;">${escapeHtml(item.reference)} · ${item.quantity} × ${escapeHtml(formatTnd(item.unitMillimes))}</span></td>
      <td style="padding:12px 0;border-bottom:1px solid #eae8e0;text-align:right;white-space:nowrap;vertical-align:middle;font-weight:600;color:#1c1b1b;">${escapeHtml(formatTnd(item.lineMillimes))}</td>
    </tr>`;
  }

  private html(
    order: PublicOrderResponse,
    customerName: string,
    customerEmail: string,
    postalCode: string,
    note: string,
    itemRows: string,
  ): string {
    const totalRows = [
      totalRow('Sous-total', formatTnd(order.totals.subtotalMillimes)),
      totalRow('Livraison', formatTnd(order.totals.shippingMillimes)),
    ].join('');
    const detailRows = [
      detailRow('Nom', customerName),
      detailRow('Téléphone', order.shipping.phone),
      detailRow('E-mail', customerEmail),
      sectionRow('Livraison'),
      detailRow('Gouvernorat', order.shipping.governorate),
      detailRow('Ville / délégation', order.shipping.city),
      detailRow('Adresse', order.shipping.address),
      detailRow('Code postal', postalCode),
      detailRow('Note de livraison', note),
    ].join('');
    return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px 12px;background:#f4f3ed;color:#1c1b1b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#feffff;border:1px solid #eae8e0;border-radius:14px;overflow:hidden;">
      <tr><td style="height:5px;background:#c89d54;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="padding:24px 28px 18px;"><p style="margin:0 0 6px;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#6b6a68;">La Maison des Montres</p><h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:700;color:#1c1b1b;">Nouvelle commande</h1><p style="margin:8px 0 0;font-size:14px;color:#6b6a68;">Référence <strong style="color:#1c1b1b;">${escapeHtml(order.reference)}</strong> · ${escapeHtml(formatDate(order.createdAt))}</p></td></tr>
      <tr><td style="padding:0 28px 22px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${detailRows}</table></td></tr>
      <tr><td style="padding:0 28px 22px;"><p style="margin:0 0 8px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#6b6a68;">Articles</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${itemRows}</table></td></tr>
      <tr><td style="padding:0 28px 28px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f4f3ed;border-radius:10px;">${totalRows}<tr><td style="padding:14px 16px;font-size:16px;font-weight:700;color:#1c1b1b;">Total · ${escapeHtml(order.currency)}</td><td style="padding:14px 16px;text-align:right;font-size:18px;font-weight:700;color:#1c1b1b;">${escapeHtml(formatTnd(order.totals.totalMillimes))}</td></tr></table><p style="margin:16px 0 0;font-size:13px;color:#6b6a68;">Paiement : <strong style="color:#1c1b1b;">${escapeHtml(order.paymentMethod.toUpperCase())}</strong></p></td></tr>
      <tr><td style="padding:16px 28px;background:#1c1b1b;color:#feffff;font-size:12px;">Notification automatique · La Maison des Montres</td></tr>
    </table>
  </body>
</html>`;
  }
}

function sectionRow(label: string): string {
  return `<tr><td colspan="2" style="padding:14px 0 8px;font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#6b6a68;border-bottom:1px solid #eae8e0;">${escapeHtml(label)}</td></tr>`;
}

function detailRow(label: string, value: string): string {
  return `<tr><td style="padding:8px 0;width:38%;font-size:13px;color:#6b6a68;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:8px 0;font-size:13px;color:#1c1b1b;vertical-align:top;">${escapeHtml(value)}</td></tr>`;
}

function totalRow(label: string, value: string): string {
  return `<tr><td style="padding:7px 16px;font-size:13px;color:#6b6a68;">${escapeHtml(label)}</td><td style="padding:7px 16px;text-align:right;font-size:13px;color:#1c1b1b;">${escapeHtml(value)}</td></tr>`;
}

function formatTnd(millimes: number): string {
  return `${(millimes / 1000).toFixed(3)} TND`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Tunis',
  }).format(new Date(value));
}

function safeImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
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
