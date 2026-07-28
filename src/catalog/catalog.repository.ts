import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  gte,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DATABASE } from '../database/database.constants';
import type { AppDatabase } from '../database/database.types';
import {
  attributes,
  attributeValues,
  brands,
  categories,
  productAttributeValues,
  productCategories,
  productImages,
  products,
  type AttributeRow,
  type AttributeValueRow,
  type BrandRow,
  type CategoryRow,
  type ProductImageRow,
  type ProductRow,
} from '../database/schema';
import type { ProductStatus } from './dto/catalog.dto';

export interface PaginationInput {
  page: number;
  pageSize: number;
  q?: string;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
  active?: boolean;
}

export interface ProductListInput extends PaginationInput {
  brandId?: string;
  categoryId?: string;
  status?: ProductStatus;
  availableOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductWrite {
  brandId: string;
  name: string;
  reference: string;
  description: string;
  price: number;
  oldPrice?: number | null;
  stock: number;
  promotionActive: boolean;
  promotionStartsAt?: Date | null;
  promotionEndsAt?: Date | null;
  status?: ProductStatus;
  seoSlug: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  categoryIds: string[];
  attributes: { attributeId: string; valueIds: string[] }[];
  images: {
    url: string;
    alt?: string | null;
    mediaProvider?: string | null;
    mediaKey?: string | null;
    sortOrder?: number;
  }[];
}

export interface ProductDetail extends ProductRow {
  categoryIds: string[];
  attributes: { attributeId: string; valueIds: string[] }[];
  images: ProductImageRow[];
}

export interface CatalogRepository {
  listBrands(input: PaginationInput): Promise<Page<BrandRow>>;
  findBrand(id: string): Promise<BrandRow | null>;
  createBrand(
    input: Omit<BrandRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandRow>;
  updateBrand(
    id: string,
    input: Partial<Omit<BrandRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandRow | null>;
  deleteBrand(id: string): Promise<boolean>;

  listCategories(input: PaginationInput): Promise<Page<CategoryRow>>;
  findCategory(id: string): Promise<CategoryRow | null>;
  createCategory(
    input: Omit<CategoryRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CategoryRow>;
  updateCategory(
    id: string,
    input: Partial<Omit<CategoryRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CategoryRow | null>;
  deleteCategory(id: string): Promise<boolean>;

  listAttributes(input: PaginationInput): Promise<Page<AttributeRow>>;
  findAttribute(id: string): Promise<AttributeRow | null>;
  createAttribute(
    input: Omit<AttributeRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AttributeRow>;
  updateAttribute(
    id: string,
    input: Partial<Omit<AttributeRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<AttributeRow | null>;
  deleteAttribute(id: string): Promise<boolean>;

  listAttributeValues(attributeId: string): Promise<AttributeValueRow[]>;
  findAttributeValue(id: string): Promise<AttributeValueRow | null>;
  createAttributeValue(
    input: Omit<AttributeValueRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AttributeValueRow>;
  updateAttributeValue(
    id: string,
    input: Partial<
      Omit<AttributeValueRow, 'id' | 'attributeId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<AttributeValueRow | null>;
  deleteAttributeValue(id: string): Promise<boolean>;

  listProducts(input: ProductListInput): Promise<Page<ProductDetail>>;
  findProduct(id: string): Promise<ProductDetail | null>;
  findProductBySlug(slug: string): Promise<ProductDetail | null>;
  createProduct(input: ProductWrite): Promise<ProductDetail>;
  updateProduct(
    id: string,
    input: Partial<ProductWrite>,
  ): Promise<ProductDetail | null>;
  deleteProduct(id: string): Promise<boolean>;
}

@Injectable()
export class DrizzleCatalogRepository implements CatalogRepository {
  constructor(
    @Inject(DATABASE) private readonly database: AppDatabase | null,
  ) {}

  listBrands(input: PaginationInput): Promise<Page<BrandRow>> {
    const conditions: SQL[] = [];
    if (input.q) conditions.push(ilike(brands.name, `%${input.q}%`));
    if (input.active !== undefined)
      conditions.push(eq(brands.active, input.active));
    const orderColumn =
      input.sortBy === 'createdAt'
        ? brands.createdAt
        : input.sortBy === 'order'
          ? brands.sortOrder
          : input.sortBy === 'slug'
            ? brands.slug
            : brands.name;
    return this.list(
      brands,
      conditions,
      input,
      input.sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn),
    );
  }

  findBrand(id: string): Promise<BrandRow | null> {
    return this.findOne(brands, brands.id, id);
  }

  async createBrand(
    input: Omit<BrandRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandRow> {
    const [row] = await this.getDatabase()
      .insert(brands)
      .values(input)
      .returning();
    return row;
  }

  async updateBrand(
    id: string,
    input: Partial<Omit<BrandRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandRow | null> {
    const [row] = await this.getDatabase()
      .update(brands)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(brands.id, id))
      .returning();
    return row ?? null;
  }

  deleteBrand(id: string): Promise<boolean> {
    return this.deleteOne(brands, brands.id, id);
  }

  listCategories(input: PaginationInput): Promise<Page<CategoryRow>> {
    const conditions: SQL[] = [];
    if (input.q) conditions.push(ilike(categories.name, `%${input.q}%`));
    if (input.active !== undefined)
      conditions.push(eq(categories.active, input.active));
    const orderColumn =
      input.sortBy === 'createdAt'
        ? categories.createdAt
        : input.sortBy === 'sortOrder' || input.sortBy === 'order'
          ? categories.sortOrder
          : categories.name;
    return this.list(
      categories,
      conditions,
      input,
      input.sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn),
    );
  }

  findCategory(id: string): Promise<CategoryRow | null> {
    return this.findOne(categories, categories.id, id);
  }

  async createCategory(
    input: Omit<CategoryRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CategoryRow> {
    const [row] = await this.getDatabase()
      .insert(categories)
      .values(input)
      .returning();
    return row;
  }

  async updateCategory(
    id: string,
    input: Partial<Omit<CategoryRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CategoryRow | null> {
    const [row] = await this.getDatabase()
      .update(categories)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return row ?? null;
  }

  deleteCategory(id: string): Promise<boolean> {
    return this.deleteOne(categories, categories.id, id);
  }

  listAttributes(input: PaginationInput): Promise<Page<AttributeRow>> {
    const conditions: SQL[] = [];
    if (input.q) conditions.push(ilike(attributes.name, `%${input.q}%`));
    if (input.active !== undefined)
      conditions.push(eq(attributes.active, input.active));
    const orderColumn =
      input.sortBy === 'createdAt'
        ? attributes.createdAt
        : input.sortBy === 'sortOrder' || input.sortBy === 'order'
          ? attributes.sortOrder
          : attributes.name;
    return this.list(
      attributes,
      conditions,
      input,
      input.sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn),
    );
  }

  findAttribute(id: string): Promise<AttributeRow | null> {
    return this.findOne(attributes, attributes.id, id);
  }

  async createAttribute(
    input: Omit<AttributeRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AttributeRow> {
    const [row] = await this.getDatabase()
      .insert(attributes)
      .values(input)
      .returning();
    return row;
  }

  async updateAttribute(
    id: string,
    input: Partial<Omit<AttributeRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<AttributeRow | null> {
    const [row] = await this.getDatabase()
      .update(attributes)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(attributes.id, id))
      .returning();
    return row ?? null;
  }

  deleteAttribute(id: string): Promise<boolean> {
    return this.deleteOne(attributes, attributes.id, id);
  }

  async listAttributeValues(attributeId: string): Promise<AttributeValueRow[]> {
    return this.getDatabase()
      .select()
      .from(attributeValues)
      .where(eq(attributeValues.attributeId, attributeId))
      .orderBy(asc(attributeValues.sortOrder), asc(attributeValues.label));
  }

  findAttributeValue(id: string): Promise<AttributeValueRow | null> {
    return this.findOne(attributeValues, attributeValues.id, id);
  }

  async createAttributeValue(
    input: Omit<AttributeValueRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AttributeValueRow> {
    const [row] = await this.getDatabase()
      .insert(attributeValues)
      .values(input)
      .returning();
    return row;
  }

  async updateAttributeValue(
    id: string,
    input: Partial<
      Omit<AttributeValueRow, 'id' | 'attributeId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<AttributeValueRow | null> {
    const [row] = await this.getDatabase()
      .update(attributeValues)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(attributeValues.id, id))
      .returning();
    return row ?? null;
  }

  deleteAttributeValue(id: string): Promise<boolean> {
    return this.deleteOne(attributeValues, attributeValues.id, id);
  }

  async listProducts(input: ProductListInput): Promise<Page<ProductDetail>> {
    const database = this.getDatabase();
    const conditions: SQL[] = [];
    if (input.q) {
      conditions.push(
        or(
          ilike(products.name, `%${input.q}%`),
          ilike(products.reference, `%${input.q}%`),
        )!,
      );
    }
    if (input.brandId) conditions.push(eq(products.brandId, input.brandId));
    if (input.categoryId) {
      conditions.push(
        sql`exists (
          select 1
          from ${productCategories}
          where ${productCategories.productId} = ${products.id}
            and ${productCategories.categoryId} = ${input.categoryId}
        )`,
      );
    }
    if (input.status) conditions.push(eq(products.status, input.status));
    if (input.availableOnly) conditions.push(sql`${products.stock} > 0`);
    if (input.minPrice !== undefined)
      conditions.push(gte(products.price, input.minPrice));
    if (input.maxPrice !== undefined)
      conditions.push(lte(products.price, input.maxPrice));
    const where = conditions.length ? and(...conditions) : undefined;
    const orderColumn =
      input.sortBy === 'price'
        ? products.price
        : input.sortBy === 'name'
          ? products.name
          : products.createdAt;
    const [rows, totalRows] = await Promise.all([
      database
        .select()
        .from(products)
        .where(where)
        .orderBy(
          input.sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn),
        )
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      database.select({ value: count() }).from(products).where(where),
    ]);
    const data = await Promise.all(rows.map((row) => this.withRelations(row)));
    return this.page(data, input, totalRows[0]?.value ?? 0);
  }

  async findProduct(id: string): Promise<ProductDetail | null> {
    const rows = await this.getDatabase()
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return rows[0] ? this.withRelations(rows[0]) : null;
  }

  async findProductBySlug(slug: string): Promise<ProductDetail | null> {
    const rows = await this.getDatabase()
      .select()
      .from(products)
      .where(eq(products.seoSlug, slug))
      .limit(1);
    return rows[0] ? this.withRelations(rows[0]) : null;
  }

  async createProduct(input: ProductWrite): Promise<ProductDetail> {
    const database = this.getDatabase();
    const product = await database.transaction(async (tx) => {
      const [row] = await tx
        .insert(products)
        .values({
          brandId: input.brandId,
          name: input.name,
          reference: input.reference,
          description: input.description,
          price: input.price,
          oldPrice: input.oldPrice,
          stock: input.stock,
          promotionActive: input.promotionActive,
          promotionStartsAt: input.promotionStartsAt,
          promotionEndsAt: input.promotionEndsAt,
          status: input.status,
          seoSlug: input.seoSlug,
          seoTitle: input.seoTitle,
          seoDescription: input.seoDescription,
        })
        .returning();
      await this.replaceProductRelations(tx, row.id, input);
      return row;
    });
    return this.withRelations(product);
  }

  async updateProduct(
    id: string,
    input: Partial<ProductWrite>,
  ): Promise<ProductDetail | null> {
    const database = this.getDatabase();
    const product = await database.transaction(async (tx) => {
      const [row] = await tx
        .update(products)
        .set({ ...this.productColumns(input), updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      if (!row) return null;
      await this.replaceProductRelations(tx, id, input);
      return row;
    });
    return product ? this.withRelations(product) : null;
  }

  deleteProduct(id: string): Promise<boolean> {
    return this.deleteOne(products, products.id, id);
  }

  private async withRelations(row: ProductRow): Promise<ProductDetail> {
    const database = this.getDatabase();
    const [categoryRows, assignmentRows, imageRows] = await Promise.all([
      database
        .select({ categoryId: productCategories.categoryId })
        .from(productCategories)
        .where(eq(productCategories.productId, row.id)),
      database
        .select({
          attributeId: productAttributeValues.attributeId,
          valueId: productAttributeValues.valueId,
        })
        .from(productAttributeValues)
        .where(eq(productAttributeValues.productId, row.id)),
      database
        .select()
        .from(productImages)
        .where(eq(productImages.productId, row.id))
        .orderBy(asc(productImages.sortOrder)),
    ]);
    const grouped = new Map<string, string[]>();
    for (const assignment of assignmentRows) {
      const values = grouped.get(assignment.attributeId) ?? [];
      values.push(assignment.valueId);
      grouped.set(assignment.attributeId, values);
    }
    return {
      ...row,
      categoryIds: categoryRows.map((item) => item.categoryId),
      attributes: [...grouped].map(([attributeId, valueIds]) => ({
        attributeId,
        valueIds,
      })),
      images: imageRows,
    };
  }

  private async replaceProductRelations(
    tx: Parameters<Parameters<AppDatabase['transaction']>[0]>[0],
    productId: string,
    input: Partial<ProductWrite>,
  ): Promise<void> {
    if (input.categoryIds) {
      await tx
        .delete(productCategories)
        .where(eq(productCategories.productId, productId));
      if (input.categoryIds.length) {
        await tx
          .insert(productCategories)
          .values(
            input.categoryIds.map((categoryId) => ({ productId, categoryId })),
          );
      }
    }
    if (input.attributes) {
      await tx
        .delete(productAttributeValues)
        .where(eq(productAttributeValues.productId, productId));
      const rows = input.attributes.flatMap((assignment) =>
        assignment.valueIds.map((valueId) => ({
          productId,
          attributeId: assignment.attributeId,
          valueId,
        })),
      );
      if (rows.length) await tx.insert(productAttributeValues).values(rows);
    }
    if (input.images) {
      await tx
        .delete(productImages)
        .where(eq(productImages.productId, productId));
      if (input.images.length) {
        await tx.insert(productImages).values(
          input.images.map((image) => ({
            productId,
            url: image.url,
            alt: image.alt,
            mediaProvider: image.mediaProvider ?? null,
            mediaKey: image.mediaKey ?? null,
            sortOrder: image.sortOrder ?? 0,
          })),
        );
      }
    }
  }

  private productColumns(
    input: Partial<ProductWrite>,
  ): Partial<typeof products.$inferInsert> {
    return {
      brandId: input.brandId,
      name: input.name,
      reference: input.reference,
      description: input.description,
      price: input.price,
      oldPrice: input.oldPrice,
      stock: input.stock,
      promotionActive: input.promotionActive,
      promotionStartsAt: input.promotionStartsAt,
      promotionEndsAt: input.promotionEndsAt,
      status: input.status,
      seoSlug: input.seoSlug,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    };
  }

  private async list<T>(
    table: PgTable,
    conditions: SQL[],
    input: PaginationInput,
    order: SQL,
  ): Promise<Page<T>> {
    const database = this.getDatabase();
    const where = conditions.length ? and(...conditions) : undefined;
    const [rawRows, rawTotalRows] = await Promise.all([
      database
        .select()
        .from(table)
        .where(where)
        .orderBy(order)
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize),
      database.select({ value: count() }).from(table).where(where),
    ]);
    const rows = rawRows as unknown as T[];
    const totalRows = rawTotalRows as unknown as { value: number }[];
    return this.page(rows, input, totalRows[0]?.value ?? 0);
  }

  private async findOne<T>(
    table: PgTable,
    column: PgColumn,
    id: string,
  ): Promise<T | null> {
    const rows = await this.getDatabase()
      .select()
      .from(table)
      .where(eq(column, id))
      .limit(1);
    return (rows[0] as T | undefined) ?? null;
  }

  private async deleteOne(
    table: PgTable,
    column: PgColumn,
    id: string,
  ): Promise<boolean> {
    const rows = await this.getDatabase()
      .delete(table)
      .where(eq(column, id))
      .returning();
    return rows.length > 0;
  }

  private page<T>(data: T[], input: PaginationInput, total: number): Page<T> {
    return {
      data,
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  private getDatabase(): AppDatabase {
    if (!this.database) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.database;
  }
}
