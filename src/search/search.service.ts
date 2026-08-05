import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ilike, or, asc, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import {
  adminUsers,
  brands,
  categories,
  orders,
  products,
} from '../database/schema';
import type { Permission } from '../auth/permissions';
import type { SearchQueryDto } from './search.dto';

export type SearchResultType =
  'product' | 'category' | 'brand' | 'order' | 'team';

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  href: string;
};

@Injectable()
export class SearchService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async search(input: SearchQueryDto, permissions: readonly Permission[] = []) {
    const query = input.q.trim();
    if (query.length < 2) return { query, results: [] as SearchResult[] };

    const database = this.getDatabase();
    const pattern = `%${query}%`;
    const bucketLimit = Math.min(8, input.limit);

    const [productRows, categoryRows, brandRows, orderRows, teamRows] =
      await Promise.all([
        database
          .select({
            id: products.id,
            name: products.name,
            reference: products.reference,
            status: products.status,
            brand: brands.name,
          })
          .from(products)
          .leftJoin(brands, eq(brands.id, products.brandId))
          .where(
            or(
              ilike(products.name, pattern),
              ilike(products.reference, pattern),
              ilike(products.seoSlug, pattern),
              ilike(brands.name, pattern),
            ),
          )
          .orderBy(asc(products.name))
          .limit(bucketLimit),
        database
          .select({
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
            active: categories.active,
          })
          .from(categories)
          .where(
            or(
              ilike(categories.name, pattern),
              ilike(categories.slug, pattern),
            ),
          )
          .orderBy(asc(categories.name))
          .limit(bucketLimit),
        database
          .select({
            id: brands.id,
            name: brands.name,
            slug: brands.slug,
            active: brands.active,
          })
          .from(brands)
          .where(or(ilike(brands.name, pattern), ilike(brands.slug, pattern)))
          .orderBy(asc(brands.name))
          .limit(bucketLimit),
        permissions.includes('orders.read')
          ? database
              .select({
                id: orders.id,
                reference: orders.reference,
                customerName: orders.customerName,
                customerPhone: orders.customerPhone,
                status: orders.status,
              })
              .from(orders)
              .where(
                or(
                  ilike(orders.reference, pattern),
                  ilike(orders.customerName, pattern),
                  ilike(orders.customerPhone, pattern),
                ),
              )
              .orderBy(asc(orders.createdAt))
              .limit(bucketLimit)
          : Promise.resolve([]),
        permissions.includes('team.manage')
          ? database
              .select({
                id: adminUsers.id,
                firstName: adminUsers.firstName,
                lastName: adminUsers.lastName,
                email: adminUsers.email,
                role: adminUsers.role,
                status: adminUsers.status,
              })
              .from(adminUsers)
              .where(
                or(
                  ilike(adminUsers.firstName, pattern),
                  ilike(adminUsers.lastName, pattern),
                  ilike(adminUsers.email, pattern),
                  sql`concat(${adminUsers.firstName}, ' ', ${adminUsers.lastName}) ilike ${pattern}`,
                ),
              )
              .orderBy(asc(adminUsers.lastName), asc(adminUsers.firstName))
              .limit(bucketLimit)
          : Promise.resolve([]),
      ]);

    const results: SearchResult[] = [
      ...productRows.map((row) => ({
        type: 'product' as const,
        id: row.id,
        title: row.name,
        subtitle: [row.reference, row.brand].filter(Boolean).join(' · '),
        status: row.status,
        href: `/products/${row.id}`,
      })),
      ...categoryRows.map((row) => ({
        type: 'category' as const,
        id: row.id,
        title: row.name,
        subtitle: row.slug,
        status: row.active ? 'active' : 'inactive',
        href: '/categories',
      })),
      ...brandRows.map((row) => ({
        type: 'brand' as const,
        id: row.id,
        title: row.name,
        subtitle: row.slug,
        status: row.active ? 'active' : 'inactive',
        href: '/featured-brands',
      })),
      ...orderRows.map((row) => ({
        type: 'order' as const,
        id: row.id,
        title: row.reference,
        subtitle: `${row.customerName} · ${row.customerPhone}`,
        status: row.status,
        href: `/orders/${row.id}`,
      })),
      ...teamRows.map((row) => ({
        type: 'team' as const,
        id: row.id,
        title: `${row.firstName} ${row.lastName}`.trim(),
        subtitle: `${row.email} · ${row.role}`,
        status: row.status,
        href: '/settings',
      })),
    ];

    return { query, results: results.slice(0, input.limit) };
  }

  private getDatabase(): AppDatabase {
    if (!this.database)
      throw new ServiceUnavailableException('Database is not configured');
    return this.database;
  }
}
