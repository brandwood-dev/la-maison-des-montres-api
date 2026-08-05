import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import {
  products,
  testimonials,
  type TestimonialRow,
} from '../database/schema';
import {
  CreateTestimonialDto,
  ListTestimonialsQueryDto,
  UpdateTestimonialDto,
} from './testimonials.dto';

export type TestimonialResponse = {
  id: string;
  fullName: string;
  message: string;
  governorate: string;
  rating: number;
  productId?: string;
  productTitle?: string;
  productSlug?: string;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TestimonialPage = {
  data: TestimonialResponse[];
  page: number;
  pageSize: number;
  total: number;
};

@Injectable()
export class TestimonialsService {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  async list(input: ListTestimonialsQueryDto): Promise<TestimonialPage> {
    const database = this.getDatabase();
    const query = input.q?.trim();
    const conditions = [];
    if (query) {
      conditions.push(
        or(
          ilike(testimonials.fullName, `%${query}%`),
          ilike(testimonials.message, `%${query}%`),
          ilike(testimonials.governorate, `%${query}%`),
          ilike(testimonials.productTitleSnapshot, `%${query}%`),
        )!,
      );
    }
    if (input.published !== undefined) {
      conditions.push(eq(testimonials.published, input.published));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const [rows, totals] = await Promise.all([
      database
        .select()
        .from(testimonials)
        .where(where)
        .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      database.select({ value: count() }).from(testimonials).where(where),
    ]);
    return {
      data: await this.withProducts(rows),
      page: input.page,
      pageSize: input.pageSize,
      total: Number(totals[0]?.value ?? 0),
    };
  }

  async publicList(): Promise<TestimonialPage> {
    const database = this.getDatabase();
    const rows = await database
      .select()
      .from(testimonials)
      .where(eq(testimonials.published, true))
      .orderBy(asc(testimonials.sortOrder), desc(testimonials.createdAt))
      .limit(12);
    return {
      data: await this.withProducts(rows),
      page: 1,
      pageSize: 12,
      total: rows.length,
    };
  }

  async get(id: string): Promise<TestimonialResponse> {
    const [row] = await this.getDatabase()
      .select()
      .from(testimonials)
      .where(eq(testimonials.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Testimonial not found');
    return (await this.withProducts([row]))[0];
  }

  async create(input: CreateTestimonialDto): Promise<TestimonialResponse> {
    const database = this.getDatabase();
    const product = input.productId
      ? await this.findProduct(input.productId)
      : null;
    const [row] = await database
      .insert(testimonials)
      .values({
        fullName: this.clean(input.fullName, 'fullName'),
        message: this.clean(input.message, 'message'),
        governorate: this.clean(input.governorate, 'governorate'),
        rating: input.rating,
        productId: product?.id ?? null,
        productTitleSnapshot:
          product?.name ?? this.optionalClean(input.productTitle),
        published: input.published ?? false,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return (await this.withProducts([row]))[0];
  }

  async update(
    id: string,
    input: UpdateTestimonialDto,
  ): Promise<TestimonialResponse> {
    const current = await this.find(id);
    if (!current) throw new NotFoundException('Testimonial not found');
    const productId =
      input.productId !== undefined ? input.productId : current.productId;
    const product = productId ? await this.findProduct(productId) : null;
    const patch = {
      ...(input.fullName !== undefined
        ? { fullName: this.clean(input.fullName, 'fullName') }
        : {}),
      ...(input.message !== undefined
        ? { message: this.clean(input.message, 'message') }
        : {}),
      ...(input.governorate !== undefined
        ? { governorate: this.clean(input.governorate, 'governorate') }
        : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.productId !== undefined
        ? { productId: product?.id ?? null }
        : {}),
      ...(input.productId !== undefined || input.productTitle !== undefined
        ? {
            productTitleSnapshot:
              product?.name ?? this.optionalClean(input.productTitle),
          }
        : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      updatedAt: new Date(),
    };
    const [row] = await this.getDatabase()
      .update(testimonials)
      .set(patch)
      .where(eq(testimonials.id, id))
      .returning();
    if (!row) throw new NotFoundException('Testimonial not found');
    return (await this.withProducts([row]))[0];
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.getDatabase()
      .delete(testimonials)
      .where(eq(testimonials.id, id))
      .returning({ id: testimonials.id });
    if (!deleted.length) throw new NotFoundException('Testimonial not found');
  }

  private async withProducts(rows: TestimonialRow[]) {
    const database = this.getDatabase();
    return Promise.all(
      rows.map(async (row) => {
        const product = row.productId
          ? await database
              .select({
                id: products.id,
                name: products.name,
                slug: products.seoSlug,
              })
              .from(products)
              .where(eq(products.id, row.productId))
              .limit(1)
              .then((result) => result[0])
          : undefined;
        return this.response(row, product);
      }),
    );
  }

  private response(
    row: TestimonialRow,
    product?: { id: string; name: string; slug: string },
  ): TestimonialResponse {
    return {
      id: row.id,
      fullName: row.fullName,
      message: row.message,
      governorate: row.governorate,
      rating: row.rating,
      ...(row.productId ? { productId: row.productId } : {}),
      ...(row.productTitleSnapshot
        ? { productTitle: row.productTitleSnapshot }
        : {}),
      ...(product ? { productSlug: product.slug } : {}),
      published: row.published,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async find(id: string): Promise<TestimonialRow | null> {
    const [row] = await this.getDatabase()
      .select()
      .from(testimonials)
      .where(eq(testimonials.id, id))
      .limit(1);
    return row ?? null;
  }

  private async findProduct(id: string) {
    const [product] = await this.getDatabase()
      .select({ id: products.id, name: products.name, slug: products.seoSlug })
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    if (!product) throw new BadRequestException('Product not found');
    return product;
  }

  private clean(value: string, field: string): string {
    const cleaned = value.trim();
    if (!cleaned) throw new BadRequestException(`${field} is required`);
    return cleaned;
  }

  private optionalClean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned || null;
  }

  private getDatabase(): AppDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.database;
  }
}
