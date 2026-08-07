import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, desc, eq, inArray, lte, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import { adminNotificationReads, orders, products } from '../database/schema';

export type AdminNotificationType =
  'new_order' | 'to_confirm' | 'low_stock' | 'review' | 'system';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  read: boolean;
  href?: string;
  createdAt: string;
}

export interface NotificationListResponse {
  data: AdminNotification[];
  page: 1;
  pageSize: number;
  total: number;
  unreadCount: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async list(adminUserId: string): Promise<NotificationListResponse> {
    const database = this.getDatabase();
    const [{ orderRows, productRows }, readRows] = await Promise.all([
      Promise.all([
        database
          .select({
            id: orders.id,
            reference: orders.reference,
            customerName: orders.customerName,
            total: orders.total,
            status: orders.status,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(or(eq(orders.status, 'new'), eq(orders.status, 'to_confirm')))
          .orderBy(desc(orders.createdAt))
          .limit(25),
        database
          .select({
            id: products.id,
            name: products.name,
            stock: products.stock,
            status: products.status,
            createdAt: products.createdAt,
            updatedAt: products.updatedAt,
          })
          .from(products)
          .where(
            and(
              inArray(products.status, ['draft', 'published']),
              lte(products.stock, 3),
            ),
          )
          .orderBy(desc(products.updatedAt))
          .limit(25),
      ]).then(([orderRows, productRows]) => ({ orderRows, productRows })),
      database
        .select({ notificationKey: adminNotificationReads.notificationKey })
        .from(adminNotificationReads)
        .where(eq(adminNotificationReads.adminUserId, adminUserId)),
    ]);

    const readKeys = new Set(readRows.map((row) => row.notificationKey));
    const items: AdminNotification[] = [];

    for (const order of orderRows) {
      const isNew = order.status === 'new';
      const id = `${isNew ? 'order:new' : 'order:confirm'}:${order.id}`;
      items.push({
        id,
        type: isNew ? 'new_order' : 'to_confirm',
        title: isNew
          ? `Nouvelle commande ${order.reference}`
          : 'Commande à confirmer',
        message: isNew
          ? `${order.customerName} — ${this.formatTnd(order.total)}`
          : `${order.reference} — paiement à la livraison`,
        read: readKeys.has(id),
        href: `/orders/${order.id}`,
        createdAt: order.createdAt.toISOString(),
      });
    }

    for (const product of productRows) {
      const id = `product:stock:${product.id}`;
      items.push({
        id,
        type: 'low_stock',
        title: 'Stock faible',
        message: `${product.name} — ${product.stock} restant(s)`,
        read: readKeys.has(id),
        href: `/products/${product.id}`,
        createdAt: (product.updatedAt ?? product.createdAt).toISOString(),
      });
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      data: items,
      page: 1,
      pageSize: items.length,
      total: items.length,
      unreadCount: items.filter((item) => !item.read).length,
    };
  }

  async markRead(adminUserId: string, notificationKey: string): Promise<void> {
    const key = this.normalizeKey(notificationKey);
    const database = this.getDatabase();
    const now = new Date();
    await database
      .insert(adminNotificationReads)
      .values({ adminUserId, notificationKey: key, readAt: now })
      .onConflictDoUpdate({
        target: [
          adminNotificationReads.adminUserId,
          adminNotificationReads.notificationKey,
        ],
        set: { readAt: now },
      });
  }

  async markAllRead(adminUserId: string): Promise<void> {
    const current = await this.list(adminUserId);
    if (current.data.length === 0) return;

    const now = new Date();
    await this.getDatabase()
      .insert(adminNotificationReads)
      .values(
        current.data.map((item) => ({
          adminUserId,
          notificationKey: item.id,
          readAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [
          adminNotificationReads.adminUserId,
          adminNotificationReads.notificationKey,
        ],
        set: { readAt: now },
      });
  }

  async markUnread(
    adminUserId: string,
    notificationKey: string,
  ): Promise<void> {
    const key = this.normalizeKey(notificationKey);
    await this.getDatabase()
      .delete(adminNotificationReads)
      .where(
        and(
          eq(adminNotificationReads.adminUserId, adminUserId),
          eq(adminNotificationReads.notificationKey, key),
        ),
      );
  }

  private normalizeKey(value: string): string {
    const key = value.trim();
    if (!key || key.length > 255) {
      throw new BadRequestException('Invalid notification key');
    }
    return key;
  }

  private formatTnd(millimes: number): string {
    return `${(millimes / 1000).toFixed(3)} TND`;
  }

  private getDatabase(): AppDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.database;
  }
}
