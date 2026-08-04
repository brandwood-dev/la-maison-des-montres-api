import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import { EmailService } from '../email/email.service';
import {
  brands,
  orderItems,
  orders,
  productImages,
  products,
  type OrderItemRow,
  type OrderRow,
} from '../database/schema';
import type {
  CreateOrderDto,
  ListOrdersQueryDto,
  OrderItemDto,
} from './dto/create-order.dto';

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
};

type StoredOrder = {
  order: OrderRow;
  items: OrderItemRow[];
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
  history: [];
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  async create(input: CreateOrderDto): Promise<PublicOrderResponse> {
    const database = this.getDatabase();
    const items = this.normalizeItems(input.items);
    const existing = await this.findByIdempotencyKey(
      database,
      input.idempotencyKey,
    );
    if (existing) return this.toResponse(existing);

    const productsById = await this.loadProducts(database, items);
    const lines = items.map((item) => {
      const product = productsById.get(item.productId);
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
    const shippingFee = this.shippingFee(subtotal);
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
          return { order: duplicate[0], items: duplicateItems };
        }

        const [order] = await tx
          .insert(orders)
          .values({
            reference,
            idempotencyKey: input.idempotencyKey,
            customerName,
            customerEmail: input.shipping.email?.trim() || null,
            customerPhone: input.shipping.phone.trim(),
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
              name: line.product.name,
              reference: line.product.reference,
              imageUrl: line.product.imageUrl,
              quantity: line.quantity,
              unitPrice: line.product.price,
              lineTotal: line.lineTotal,
            })),
          )
          .returning();
        return { order, items: storedItems };
      });
      const response = this.toResponse(stored, productsById);
      await this.email.notifyNewOrder(response);
      return response;
    } catch (error) {
      // A concurrent retry may win the idempotency race. Return its order
      // rather than creating a second order or exposing a database error.
      if (this.isUniqueViolation(error)) {
        const duplicate = await this.findByIdempotencyKey(
          database,
          input.idempotencyKey,
        );
        if (duplicate) return this.toResponse(duplicate);
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
        this.toAdminResponse({ order: row, items: itemRows.get(row.id) ?? [] }),
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
    return this.toAdminResponse({ order, items: itemRows.get(order.id) ?? [] });
  }

  async updateStatus(
    id: string,
    nextStatus: AdminOrderResponse['status'],
  ): Promise<AdminOrderResponse> {
    const database = this.getDatabase();
    const current = await this.get(id);
    const allowed = this.allowedStatusTransitions(current.status);
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'This order status cannot be changed to the requested value',
      });
    }
    const [updated] = await database
      .update(orders)
      .set({
        status: nextStatus,
        deliveredAt:
          nextStatus === 'delivered'
            ? new Date()
            : current.deliveredAt
              ? new Date(current.deliveredAt)
              : null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Order not found');
    return this.toAdminResponse({
      order: updated,
      items: current.items.map((item) => ({
        id: item.id,
        orderId: updated.id,
        productId: item.productId,
        name: item.name,
        reference: item.reference,
        imageUrl: item.imageUrl ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
    });
  }

  private normalizeItems(items: OrderItemDto[]): OrderItemDto[] {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.productId)) {
        throw new BadRequestException({
          code: 'DUPLICATE_PRODUCT',
          message: 'Each product may appear only once in an order',
        });
      }
      seen.add(item.productId);
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
    return snapshots;
  }

  private shippingFee(subtotal: number): number {
    if (subtotal === 0) return 0;
    const threshold = this.config.get<number>(
      'COD_FREE_SHIPPING_THRESHOLD_MILLIMES',
      500_000,
    );
    if (subtotal >= threshold) return 0;
    return this.config.get<number>('COD_SHIPPING_FEE_MILLIMES', 8_000);
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
    return { order, items };
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
      history: [],
      idempotencyKey: stored.order.idempotencyKey,
      createdAt: stored.order.createdAt.toISOString(),
      updatedAt: stored.order.updatedAt.toISOString(),
      deliveredAt: stored.order.deliveredAt?.toISOString(),
    };
  }

  private allowedStatusTransitions(
    status: AdminOrderResponse['status'],
  ): AdminOrderResponse['status'][] {
    const transitions: Record<
      AdminOrderResponse['status'],
      AdminOrderResponse['status'][]
    > = {
      new: ['to_confirm', 'cancelled'],
      to_confirm: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'returned'],
      delivered: ['returned'],
      cancelled: [],
      returned: [],
    };
    return transitions[status];
  }

  private toResponse(
    stored: StoredOrder,
    snapshots = new Map<string, ProductSnapshot>(),
  ): PublicOrderResponse {
    const itemResponses = stored.items.map((item) => {
      const snapshot = snapshots.get(item.productId);
      return {
        productId: item.productId,
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
