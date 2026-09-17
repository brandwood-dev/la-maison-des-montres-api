import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import { EmailService } from '../email/email.service';
import { TeamService } from '../team/team.service';
import {
  SettingsService,
  type StoreSettingsResponse,
} from '../settings/settings.service';
import {
  brands,
  orderItems,
  orderStatusHistory,
  orders,
  productImages,
  productVariants,
  products,
  type OrderItemRow,
  type OrderRow,
  type OrderStatusHistoryRow,
} from '../database/schema';
import type { AuthenticatedAdmin } from '../auth/auth.types';
import type {
  CreateOrderDto,
  ListOrdersQueryDto,
  OrderItemDto,
} from './dto/create-order.dto';
import {
  allowedOrderStatusTransitions,
  type OrderStatus,
} from './order-status';
import { MetaConversionsService } from '../meta/meta-conversions.service';

type ProductSnapshot = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  reference: string;
  price: number;
  stock: number;
  status: 'draft' | 'published' | 'hidden';
  imageUrl: string | null;
  imageAlt: string;
  variantId?: string;
  variantLabel?: string;
};

type StoredOrder = {
  order: OrderRow;
  items: OrderItemRow[];
  history: OrderStatusHistoryRow[];
};

export type PublicOrderResponse = {
  id: string;
  reference: string;
  createdAt: string;
  status: OrderRow['status'];
  paymentMethod: OrderRow['paymentMethod'];
  currency: string;
  shippingLabel: string;
  shipping: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    governorate: string;
    city: string;
    address: string;
    postalCode: string | null;
    note: string | null;
  };
  items: Array<{
    productId: string;
    variantId?: string;
    variantLabel?: string;
    name: string;
    brand: string;
    reference: string;
    slug: string;
    imageUrl: string | null;
    imageAlt: string;
    quantity: number;
    unitMillimes: number;
    lineMillimes: number;
  }>;
  totals: {
    subtotalMillimes: number;
    shippingMillimes: number;
    totalMillimes: number;
    itemCount: number;
  };
};

export type PublicOrderTrackingResponse = Pick<
  PublicOrderResponse,
  | 'id'
  | 'reference'
  | 'createdAt'
  | 'status'
  | 'paymentMethod'
  | 'currency'
  | 'shippingLabel'
  | 'items'
  | 'totals'
>;

export type AdminOrderResponse = {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{
    id: string;
    productId: string;
    variantId?: string;
    variantLabel?: string;
    name: string;
    reference: string;
    imageUrl?: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  shipping: { method: 'standard'; fee: number; etaDays?: string };
  discountTotal: number;
  total: number;
  currency: string;
  status: OrderRow['status'];
  payment: { method: 'cod'; status: OrderRow['paymentStatus'] };
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    city: string;
    region: string;
    postalCode?: string;
    country: string;
  };
  history: Array<{
    at: string;
    byUserId?: string;
    byName: string;
    action: string;
    note?: string;
    fromStatus?: OrderRow['status'];
    toStatus: OrderRow['status'];
  }>;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
    private readonly email: EmailService,
    private readonly settings: SettingsService,
    private readonly team: TeamService,
    private readonly meta: MetaConversionsService,
  ) {}

  async create(input: CreateOrderDto): Promise<PublicOrderResponse> {
    const database = this.getDatabase();
    const items = this.normalizeItems(input.items);
    const existing = await this.findByIdempotencyKey(
      database,
      input.idempotencyKey,
    );
    if (existing) {
      const response = this.toResponse(existing);
      // Reusing the same event_id is safe if a previous delivery was
      // interrupted; Meta deduplicates the retry by order reference.
      // Analytics is fail-open and must not add Meta network latency to a
      // checkout response. The service itself handles errors and timeouts.
      void this.meta.sendPurchase(response, { fbp: input.fbp, fbc: input.fbc });
      return response;
    }

    const [productsById, settings] = await Promise.all([
      this.loadProducts(database, items),
      this.settings.get(),
    ]);
    const lines = items.map((item) => {
      const product = productsById.get(
        item.variantId ? `${item.productId}:${item.variantId}` : item.productId,
      );
      if (!product || product.status !== 'published' || product.stock <= 0) {
        throw new UnprocessableEntityException({
          code: 'PRODUCT_UNAVAILABLE',
          message: 'One or more products are no longer available',
        });
      }
      if (item.quantity > product.stock) {
        throw new UnprocessableEntityException({
          code: 'INSUFFICIENT_STOCK',
          message: 'The requested quantity is not available',
        });
      }
      return {
        product,
        quantity: item.quantity,
        lineTotal: product.price * item.quantity,
      };
    });

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const shippingFee = this.shippingFee(subtotal, settings.shipping);
    const total = subtotal + shippingFee;
    const customerName = `${input.shipping.firstName.trim()} ${input.shipping.lastName.trim()}`;
    const reference = this.generateReference();

    try {
      const stored = await database.transaction(async (tx) => {
        const duplicate = await tx
          .select()
          .from(orders)
          .where(eq(orders.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (duplicate[0]) {
          const duplicateItems = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, duplicate[0].id))
            .orderBy(asc(orderItems.id));
          return { order: duplicate[0], items: duplicateItems, history: [] };
        }

        const [order] = await tx
          .insert(orders)
          .values({
            reference,
            idempotencyKey: input.idempotencyKey,
            customerName,
            customerEmail: input.shipping.email?.trim() || null,
            customerPhone: input.shipping.phone.trim(),
            customerPhoneNormalized: normalizeTunisiaPhone(
              input.shipping.phone,
            ),
            governorate: input.shipping.governorate.trim(),
            city: input.shipping.city.trim(),
            address: input.shipping.address.trim(),
            postalCode: input.shipping.postalCode?.trim() || null,
            notes: input.shipping.note?.trim() || null,
            subtotal,
            shippingFee,
            total,
            currency: 'TND',
            status: 'new',
            paymentMethod: 'cod',
            paymentStatus: 'pending',
          })
          .returning();

        const storedItems = await tx
          .insert(orderItems)
          .values(
            lines.map((line) => ({
              orderId: order.id,
              productId: line.product.id,
              ...(line.product.variantId
                ? { variantId: line.product.variantId }
                : {}),
              ...(line.product.variantLabel
                ? { variantLabel: line.product.variantLabel }
                : {}),
              name: line.product.name,
              reference: line.product.reference,
              imageUrl: line.product.imageUrl,
              quantity: line.quantity,
              unitPrice: line.product.price,
              lineTotal: line.lineTotal,
            })),
          )
          .returning();
        await tx.insert(orderStatusHistory).values({
          orderId: order.id,
          toStatus: order.status,
          changedByName: 'Système',
          action: 'Commande créée',
          createdAt: order.createdAt,
        });
        return { order, items: storedItems, history: [] };
      });
      const response = this.toResponse(stored, productsById);
      let recipients: string[] = [];
      try {
        recipients = await this.team.listOrderNotificationRecipients();
      } catch {
        // Keep order creation independent from an unavailable team lookup;
        // EmailService will use the configured operational fallback address.
      }
      await this.email.notifyNewOrder(response, recipients);
      // Analytics is fail-open and must not add Meta network latency to a
      // checkout response. The service itself handles errors and timeouts.
      void this.meta.sendPurchase(response, { fbp: input.fbp, fbc: input.fbc });
      return response;
    } catch (error) {
      // A concurrent retry may win the idempotency race. Return its order
      // rather than creating a second order or exposing a database error.
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.findByIdempotencyKey(
          database,
          input.idempotencyKey,
        );
        if (duplicate) {
          const response = this.toResponse(duplicate);
          void this.meta.sendPurchase(response, {
            fbp: input.fbp,
            fbc: input.fbc,
          });
          return response;
        }
      }
      throw error;
    }
  }

  async list(input: ListOrdersQueryDto) {
    const database = this.getDatabase();
    const conditions = [];
    if (input.q?.trim()) {
      const query = `%${input.q.trim()}%`;
      conditions.push(
        or(
          ilike(orders.reference, query),
          ilike(orders.customerName, query),
          ilike(orders.customerPhone, query),
        )!,
      );
    }
    if (input.status) conditions.push(eq(orders.status, input.status));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await database
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const [{ value: total }] = await database
      .select({ value: count() })
      .from(orders)
      .where(where);
    const itemRows = await this.itemsForOrders(
      database,
      rows.map((row) => row.id),
    );
    return {
      data: rows.map((row) =>
        this.toAdminResponse({
          order: row,
          items: itemRows.get(row.id) ?? [],
          history: [],
        }),
      ),
      page: input.page,
      pageSize: input.pageSize,
      total: Number(total ?? 0),
    };
  }

  /**
   * Public tracking is intentionally scoped by both the order reference and
   * the phone supplied at checkout. PII such as the address and email is not
   * returned to the browser.
   */
  async track(
    referenceInput: string,
    phoneInput: string,
  ): Promise<PublicOrderTrackingResponse> {
    const database = this.getDatabase();
    const reference = referenceInput.trim().toUpperCase();
    const phone = normalizeTunisiaPhone(phoneInput);
    if (!phone || !reference) throw new NotFoundException('Order not found');

    const [order] = await database
      .select()
      .from(orders)
      .where(eq(orders.reference, reference))
      .limit(1);
    if (!order || normalizeTunisiaPhone(order.customerPhone) !== phone) {
      throw new NotFoundException('Order not found');
    }

    const itemRows = await this.itemsForOrders(database, [order.id]);
    const response = this.toResponse({
      order,
      items: itemRows.get(order.id) ?? [],
      history: [],
    });
    return {
      id: response.id,
      reference: response.reference,
      createdAt: response.createdAt,
      status: response.status,
      paymentMethod: response.paymentMethod,
      currency: response.currency,
      shippingLabel: response.shippingLabel,
      items: response.items,
      totals: response.totals,
    };
  }

  async get(id: string): Promise<AdminOrderResponse> {
    const database = this.getDatabase();
    const [order] = await database
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);
    if (!order) throw new NotFoundException('Order not found');
    const itemRows = await this.itemsForOrders(database, [order.id]);
    const historyRows = await this.historyForOrders(database, [order.id]);
    return this.toAdminResponse({
      order,
      items: itemRows.get(order.id) ?? [],
      history: historyRows.get(order.id) ?? [],
    });
  }

  async updateStatus(
    id: string,
    nextStatus: AdminOrderResponse['status'],
    actor: Pick<AuthenticatedAdmin, 'id' | 'email' | 'fullName'>,
  ): Promise<AdminOrderResponse> {
    const database = this.getDatabase();
    await database.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, id))
        .limit(1);
      if (!current) throw new NotFoundException('Order not found');

      const statusChanged = current.status !== nextStatus;
      const paymentNeedsReconciliation =
        nextStatus === 'delivered' && current.paymentStatus === 'pending';
      if (!statusChanged && !paymentNeedsReconciliation) return;

      if (
        statusChanged &&
        !this.allowedStatusTransitions(current.status).includes(nextStatus)
      ) {
        throw new BadRequestException({
          code: 'INVALID_STATUS_TRANSITION',
          message: 'This order status cannot be changed to the requested value',
        });
      }

      const now = new Date();
      await tx
        .update(orders)
        .set({
          status: nextStatus,
          paymentStatus: paymentNeedsReconciliation
            ? 'paid'
            : current.paymentStatus,
          deliveredAt:
            nextStatus === 'delivered'
              ? current.status === 'delivered' && current.deliveredAt
                ? current.deliveredAt
                : now
              : null,
          updatedAt: now,
        })
        .where(eq(orders.id, id));

      if (statusChanged) {
        await tx.insert(orderStatusHistory).values({
          orderId: id,
          fromStatus: current.status,
          toStatus: nextStatus,
          changedBy: actor.id,
          changedByName: actor.fullName || actor.email,
          changedByEmail: actor.email,
          action: 'Statut de commande modifié',
          ...(paymentNeedsReconciliation
            ? { note: 'Paiement COD automatiquement marqué comme payé.' }
            : {}),
          createdAt: now,
        });
      }
    });

    return this.get(id);
  }

  private normalizeItems(items: OrderItemDto[]): OrderItemDto[] {
    const seen = new Set<string>();
    for (const item of items) {
      const key = `${item.productId}:${item.variantId ?? ''}`;
      if (seen.has(key)) {
        throw new BadRequestException({
          code: 'DUPLICATE_PRODUCT',
          message: 'Each product may appear only once in an order',
        });
      }
      seen.add(key);
    }
    return items;
  }

  private async loadProducts(
    database: AppDatabase,
    items: OrderItemDto[],
  ): Promise<Map<string, ProductSnapshot>> {
    const ids = items.map((item) => item.productId);
    const rows = await database
      .select({
        id: products.id,
        slug: products.seoSlug,
        name: products.name,
        brand: brands.name,
        reference: products.reference,
        price: products.price,
        stock: products.stock,
        status: products.status,
        imageUrl: productImages.url,
        imageAlt: productImages.alt,
        imageOrder: productImages.sortOrder,
      })
      .from(products)
      .innerJoin(brands, eq(brands.id, products.brandId))
      .leftJoin(productImages, eq(productImages.productId, products.id))
      .where(inArray(products.id, ids))
      .orderBy(asc(productImages.sortOrder));

    const snapshots = new Map<string, ProductSnapshot>();
    for (const row of rows) {
      const existing = snapshots.get(row.id);
      if (existing) continue;
      snapshots.set(row.id, {
        id: row.id,
        slug: row.slug,
        name: row.name,
        brand: row.brand,
        reference: row.reference,
        price: row.price,
        stock: row.stock,
        status: row.status,
        imageUrl: row.imageUrl ?? null,
        imageAlt: row.imageAlt ?? row.name,
      });
    }
    const variantRows = await database
      .select()
      .from(productVariants)
      .where(inArray(productVariants.productId, ids))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.label));
    const variantsByProduct = new Map<string, typeof variantRows>();
    for (const variant of variantRows) {
      variantsByProduct.set(variant.productId, [
        ...(variantsByProduct.get(variant.productId) ?? []),
        variant,
      ]);
    }
    for (const [productId, variants] of variantsByProduct) {
      const base = snapshots.get(productId);
      if (!base) continue;
      for (const variant of variants.filter((item) => item.active)) {
        snapshots.set(`${productId}:${variant.id}`, {
          ...base,
          price: variant.price,
          stock: variant.stock,
          variantId: variant.id,
          variantLabel: variant.label,
        });
      }
      // Product cards may add a product without a selected variant. Resolve
      // that legacy line to the first active in-stock variant.
      const fallback = variants.find((item) => item.active && item.stock > 0);
      if (fallback) {
        snapshots.set(productId, {
          ...base,
          price: fallback.price,
          stock: fallback.stock,
          variantId: fallback.id,
          variantLabel: fallback.label,
        });
      }
    }
    return snapshots;
  }

  private shippingFee(
    subtotal: number,
    shipping: StoreSettingsResponse['shipping'],
  ): number {
    if (subtotal === 0) return 0;
    if (shipping.freeShippingEnabled) return 0;
    if (
      shipping.freeShippingThresholdMillimes !== undefined &&
      subtotal >= shipping.freeShippingThresholdMillimes
    ) {
      return 0;
    }
    return shipping.feeMillimes;
  }

  private generateReference(): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `LMM-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private async findByIdempotencyKey(
    database: AppDatabase,
    key: string,
  ): Promise<StoredOrder | null> {
    const [order] = await database
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, key))
      .limit(1);
    if (!order) return null;
    const items = await database
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.id));
    return { order, items, history: [] };
  }

  private async itemsForOrders(
    database: AppDatabase,
    orderIds: string[],
  ): Promise<Map<string, OrderItemRow[]>> {
    const grouped = new Map<string, OrderItemRow[]>();
    if (orderIds.length === 0) return grouped;
    const rows = await database
      .select()
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds))
      .orderBy(asc(orderItems.id));
    for (const row of rows) {
      grouped.set(row.orderId, [...(grouped.get(row.orderId) ?? []), row]);
    }
    return grouped;
  }

  private async historyForOrders(
    database: AppDatabase,
    orderIds: string[],
  ): Promise<Map<string, OrderStatusHistoryRow[]>> {
    const grouped = new Map<string, OrderStatusHistoryRow[]>();
    if (orderIds.length === 0) return grouped;
    const rows = await database
      .select()
      .from(orderStatusHistory)
      .where(inArray(orderStatusHistory.orderId, orderIds))
      .orderBy(desc(orderStatusHistory.createdAt));
    for (const row of rows) {
      grouped.set(row.orderId, [...(grouped.get(row.orderId) ?? []), row]);
    }
    return grouped;
  }

  private toAdminResponse(stored: StoredOrder): AdminOrderResponse {
    return {
      id: stored.order.id,
      reference: stored.order.reference,
      customerId: '',
      customerName: stored.order.customerName,
      customerPhone: stored.order.customerPhone,
      items: stored.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.variantLabel ? { variantLabel: item.variantLabel } : {}),
        name: item.name,
        reference: item.reference,
        ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: stored.order.subtotal,
      shipping: {
        method: 'standard',
        fee: stored.order.shippingFee,
        etaDays: '2 à 3 jours ouvrés',
      },
      discountTotal: 0,
      total: stored.order.total,
      currency: stored.order.currency,
      status: stored.order.status,
      payment: {
        method: 'cod',
        status: stored.order.paymentStatus,
      },
      shippingAddress: {
        fullName: stored.order.customerName,
        phone: stored.order.customerPhone,
        line1: stored.order.address,
        city: stored.order.city,
        region: stored.order.governorate,
        ...(stored.order.postalCode
          ? { postalCode: stored.order.postalCode }
          : {}),
        country: 'Tunisie',
      },
      history: stored.history.map((entry) => ({
        at: entry.createdAt.toISOString(),
        ...(entry.changedBy ? { byUserId: entry.changedBy } : {}),
        byName: entry.changedByName,
        action: entry.action,
        ...(entry.note ? { note: entry.note } : {}),
        ...(entry.fromStatus ? { fromStatus: entry.fromStatus } : {}),
        toStatus: entry.toStatus,
      })),
      idempotencyKey: stored.order.idempotencyKey,
      createdAt: stored.order.createdAt.toISOString(),
      updatedAt: stored.order.updatedAt.toISOString(),
      deliveredAt: stored.order.deliveredAt?.toISOString(),
    };
  }

  private allowedStatusTransitions(status: OrderStatus): OrderStatus[] {
    return allowedOrderStatusTransitions(status);
  }

  private toResponse(
    stored: StoredOrder,
    snapshots = new Map<string, ProductSnapshot>(),
  ): PublicOrderResponse {
    const itemResponses = stored.items.map((item) => {
      const snapshot = snapshots.get(item.productId);
      return {
        productId: item.productId,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        ...(item.variantLabel ? { variantLabel: item.variantLabel } : {}),
        name: item.name,
        brand: snapshot?.brand ?? '',
        reference: item.reference,
        slug: snapshot?.slug ?? '',
        imageUrl: item.imageUrl,
        imageAlt: snapshot?.imageAlt ?? item.name,
        quantity: item.quantity,
        unitMillimes: item.unitPrice,
        lineMillimes: item.lineTotal,
      };
    });
    return {
      id: stored.order.id,
      reference: stored.order.reference,
      createdAt: stored.order.createdAt.toISOString(),
      status: stored.order.status,
      paymentMethod: stored.order.paymentMethod,
      currency: stored.order.currency,
      shippingLabel: `${stored.order.governorate} — ${stored.order.city}`,
      shipping: {
        firstName: stored.order.customerName.split(' ')[0] ?? '',
        lastName: stored.order.customerName.split(' ').slice(1).join(' '),
        phone: stored.order.customerPhone,
        email: stored.order.customerEmail,
        governorate: stored.order.governorate,
        city: stored.order.city,
        address: stored.order.address,
        postalCode: stored.order.postalCode,
        note: stored.order.notes,
      },
      items: itemResponses,
      totals: {
        subtotalMillimes: stored.order.subtotal,
        shippingMillimes: stored.order.shippingFee,
        totalMillimes: stored.order.total,
        itemCount: stored.items.reduce((sum, item) => sum + item.quantity, 0),
      },
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      String((error as { code?: unknown }).code) === '23505',
    );
  }

  private getDatabase(): AppDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.database;
  }
}

function normalizeTunisiaPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-.()]/g, '');
  const match = cleaned.match(/^(?:\+216|00216)?(\d{8})$/);
  if (!match || !/^[234579]/.test(match[1])) return null;
  return `+216${match[1]}`;
}
