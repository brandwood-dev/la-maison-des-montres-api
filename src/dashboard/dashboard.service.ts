import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, count, desc, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import { orderItems, orders, products } from '../database/schema';
import type { DashboardStatsQueryDto } from './dashboard.dto';

type DashboardStats = {
  revenueMillimes: number;
  deliveredOrdersCount: number;
  averageBasketMillimes: number;
  customersCount: number;
  lowStockCount: number;
  lowStockProducts: Array<{
    id: string;
    name: string;
    reference: string;
    stock: number;
  }>;
  revenueSeries: Array<{ date: string; value: number }>;
  ordersSeries: Array<{ date: string; value: number }>;
  topProducts: Array<{
    productId: string;
    name: string;
    sold: number;
    revenue: number;
  }>;
  recentActivity: Array<{ at: string; text: string }>;
  recentOrders: Array<{
    id: string;
    reference: string;
    customerName: string;
    total: number;
    status: string;
    createdAt: string;
  }>;
};

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async stats(input: DashboardStatsQueryDto): Promise<DashboardStats> {
    const database = this.database;
    if (!database)
      throw new ServiceUnavailableException('Database unavailable');
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'Dashboard dates must be valid ISO-8601 values',
      });
    }
    if (from >= to) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'Dashboard start date must be before end date',
      });
    }
    if (to.getTime() - from.getTime() > 366 * 86_400_000) {
      throw new BadRequestException({
        code: 'DATE_RANGE_TOO_LARGE',
        message: 'Dashboard periods cannot exceed 366 days',
      });
    }

    const deliveredWhere = and(
      eq(orders.status, 'delivered'),
      isNotNull(orders.deliveredAt),
      gte(orders.deliveredAt, from),
      lt(orders.deliveredAt, to),
    );
    const day = sql<string>`to_char(${orders.deliveredAt} at time zone ${input.timezone}, 'YYYY-MM-DD')`;
    const [
      totals,
      daily,
      customers,
      lowStock,
      lowStockProducts,
      topProducts,
      recentOrders,
    ] = await Promise.all([
      database
        .select({
          revenue: sql<string>`coalesce(sum(${orders.subtotal}), 0)`,
          orderCount: sql<string>`count(*)`,
        })
        .from(orders)
        .where(deliveredWhere),
      database
        .select({
          date: day,
          revenue: sql<string>`coalesce(sum(${orders.subtotal}), 0)`,
          orderCount: sql<string>`count(*)`,
        })
        .from(orders)
        .where(deliveredWhere)
        // Use positional references so Drizzle does not bind the timezone
        // parameter three times. PostgreSQL treats those distinct bind
        // parameters as different expressions during GROUP BY validation.
        .groupBy(sql.raw('1'))
        .orderBy(sql.raw('1')),
      database
        // A customer is any order holder, regardless of order status. The
        // canonical phone prevents duplicates caused by spaces, +216, 00216
        // or local Tunisian formats.
        .select({
          value: sql<string>`count(distinct ${orders.customerPhoneNormalized})`,
        })
        .from(orders)
        .where(isNotNull(orders.customerPhoneNormalized)),
      database
        .select({ value: count() })
        .from(products)
        .where(
          and(sql`${products.status} <> 'hidden'`, lteStock(products.stock)),
        ),
      database
        .select({
          id: products.id,
          name: products.name,
          reference: products.reference,
          stock: products.stock,
        })
        .from(products)
        .where(
          and(sql`${products.status} <> 'hidden'`, lteStock(products.stock)),
        )
        .orderBy(products.stock)
        .limit(5),
      database
        .select({
          productId: orderItems.productId,
          name: orderItems.name,
          sold: sql<string>`coalesce(sum(${orderItems.quantity}), 0)`,
          revenue: sql<string>`coalesce(sum(${orderItems.lineTotal}), 0)`,
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(deliveredWhere)
        .groupBy(orderItems.productId, orderItems.name)
        .orderBy(desc(sql`sum(${orderItems.lineTotal})`))
        .limit(5),
      database
        .select({
          id: orders.id,
          createdAt: orders.createdAt,
          reference: orders.reference,
          customerName: orders.customerName,
          total: orders.total,
          status: orders.status,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .limit(8),
    ]);

    const revenue = Number(totals[0]?.revenue ?? 0);
    const deliveredOrdersCount = Number(totals[0]?.orderCount ?? 0);
    const revenueSeries = this.series(
      from,
      to,
      input.timezone,
      daily,
      'revenue',
    );
    const ordersSeries = this.series(from, to, input.timezone, daily, 'orders');
    return {
      revenueMillimes: revenue,
      deliveredOrdersCount,
      averageBasketMillimes:
        deliveredOrdersCount > 0
          ? Math.round(revenue / deliveredOrdersCount)
          : 0,
      customersCount: Number(customers[0]?.value ?? 0),
      lowStockCount: Number(lowStock[0]?.value ?? 0),
      lowStockProducts,
      revenueSeries,
      ordersSeries,
      topProducts: topProducts.map((item) => ({
        productId: item.productId,
        name: item.name,
        sold: Number(item.sold),
        revenue: Number(item.revenue),
      })),
      recentActivity: recentOrders.map((item) => ({
        at: item.createdAt.toISOString(),
        text: `Commande ${item.reference} · ${item.status}`,
      })),
      recentOrders: recentOrders.map((item) => ({
        id: item.id,
        reference: item.reference,
        customerName: item.customerName,
        total: Number(item.total),
        status: item.status,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  private series(
    from: Date,
    to: Date,
    timezone: string,
    daily: Array<{ date: string; revenue: string; orderCount: string }>,
    metric: 'revenue' | 'orders',
  ): Array<{ date: string; value: number }> {
    const values = new Map(
      daily.map((item) => [
        item.date,
        metric === 'revenue' ? Number(item.revenue) : Number(item.orderCount),
      ]),
    );
    const output: Array<{ date: string; value: number }> = [];
    const cursor = new Date(from);
    while (cursor < to) {
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(cursor);
      output.push({ date, value: values.get(date) ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return output;
  }
}

function lteStock(column: typeof products.stock) {
  return sql`${column} <= 5`;
}
