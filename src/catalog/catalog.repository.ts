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
  inArray,
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
  filterable?: boolean;
}

export interface ProductListInput extends PaginationInput {
  brandId?: string;
  categoryId?: string;
  status?: ProductStatus;
  availableOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  promotion?: 'active';
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
  seoSlugCustom?: boolean;
  seoTitleCustom?: boolean;
  seoDescriptionCustom?: boolean;
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
  /**
   * Optional read-model enrichment populated by the SQL repository.
   * Keeping it optional preserves the lightweight fake repository used by
   * unit tests and by write paths that only need the identifiers above.
   */
  enrichment?: {
    brand?: BrandRow;
    categories: CategoryRow[];
    attributes: AttributeRow[];
    values: AttributeValueRow[];
  };
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
  findCategoryBySlug(slug: string): Promise<CategoryRow | null>;
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
  listAttributeValuesByAttributeIds?: (
    attributeIds: string[],
  ) => Promise<AttributeValueRow[]>;
  findAttributeValue(id: string): Promise<AttributeValueRow | null>;
  findAttributesByIds?: (ids: string[]) => Promise<AttributeRow[]>;
  findAttributeValuesByIds?: (ids: string[]) => Promise<AttributeValueRow[]>;
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
  findProductByReference(reference: string): Promise<ProductDetail | null>;
  nextProductReferenceSequence(): Promise<number>;
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

  findCategoryBySlug(slug: string): Promise<CategoryRow | null> {
    return this.findOne(categories, categories.slug, slug);
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
    if (input.filterable !== undefined)
      conditions.push(eq(attributes.filterable, input.filterable));
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

  async listAttributeValuesByAttributeIds(
    attributeIds: string[],
  ): Promise<AttributeValueRow[]> {
    if (attributeIds.length === 0) return [];
    return this.getDatabase()
      .select()
      .from(attributeValues)
      .where(inArray(attributeValues.attributeId, attributeIds))
      .orderBy(
        asc(attributeValues.attributeId),
        asc(attributeValues.sortOrder),
        asc(attributeValues.label),
      );
  }

  findAttributeValue(id: string): Promise<AttributeValueRow | null> {
    return this.findOne(attributeValues, attributeValues.id, id);
  }

  async findAttributesByIds(ids: string[]): Promise<AttributeRow[]> {
    if (ids.length === 0) return [];
    return this.getDatabase()
      .select()
      .from(attributes)
      .where(inArray(attributes.id, ids));
  }

  async findAttributeValuesByIds(ids: string[]): Promise<AttributeValueRow[]> {
    if (ids.length === 0) return [];
    return this.getDatabase()
      .select()
      .from(attributeValues)
      .where(inArray(attributeValues.id, ids));
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
    if (input.promotion === 'active') {
      const now = sql`now()`;
      conditions.push(
        sql`${products.promotionActive} = true
          and ${products.oldPrice} is not null
          and ${products.oldPrice} > ${products.price}
          and (${products.promotionStartsAt} is null or ${products.promotionStartsAt} <= ${now})
          and ${products.promotionEndsAt} is not null
          and ${products.promotionEndsAt} > ${now}`,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const orderColumn =
      input.sortBy === 'price'
        ? products.price
        : input.sortBy === 'name'
          ? products.name
          : products.createdAt;
    const rows = await database
      .select()
      .from(products)
      .where(where)
      .orderBy(
        input.sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn),
      )
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const totalRows = await database
      .select({ value: count() })
      .from(products)
      .where(where);
    const data = await this.withRelations(rows);
    return this.page(data, input, totalRows[0]?.value ?? 0);
  }

  async findProduct(id: string): Promise<ProductDetail | null> {
    const rows = await this.getDatabase()
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return rows[0] ? (await this.withRelations(rows))[0] : null;
  }

  async findProductBySlug(slug: string): Promise<ProductDetail | null> {
    const rows = await this.getDatabase()
      .select()
      .from(products)
      .where(eq(products.seoSlug, slug))
      .limit(1);
    return rows[0] ? (await this.withRelations(rows))[0] : null;
  }

  async findProductByReference(
    reference: string,
  ): Promise<ProductDetail | null> {
    const rows = await this.getDatabase()
      .select()
      .from(products)
      .where(sql`lower(${products.reference}) = lower(${reference})`)
      .limit(1);
    return rows[0] ? (await this.withRelations(rows))[0] : null;
  }

  async nextProductReferenceSequence(): Promise<number> {
    const rows = await this.getDatabase().execute(
      sql`select nextval('app.product_reference_seq') as value`,
    );
    const value = Number(
      (rows as unknown as Array<{ value: string }>)[0]?.value,
    );
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new ServiceUnavailableException('Reference sequence unavailable');
    }
    return value;
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
          seoSlugCustom: input.seoSlugCustom,
          seoTitleCustom: input.seoTitleCustom,
          seoDescriptionCustom: input.seoDescriptionCustom,
        })
        .returning();
      await this.replaceProductRelations(tx, row.id, input);
      return row;
    });
    return (await this.withRelations([product]))[0];
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
    return product ? (await this.withRelations([product]))[0] : null;
  }

  deleteProduct(id: string): Promise<boolean> {
    return this.deleteOne(products, products.id, id);
  }

  private async withRelations(rows: ProductRow[]): Promise<ProductDetail[]> {
    if (rows.length === 0) return [];

    const database = this.getDatabase();
    const productIds = rows.map((row) => row.id);
    const [categoryRows, assignmentRows, imageRows] = await Promise.all([
      database
        .select({
          productId: productCategories.productId,
          categoryId: productCategories.categoryId,
        })
        .from(productCategories)
        .where(inArray(productCategories.productId, productIds)),
      database
        .select({
          productId: productAttributeValues.productId,
          attributeId: productAttributeValues.attributeId,
          valueId: productAttributeValues.valueId,
        })
        .from(productAttributeValues)
        .where(inArray(productAttributeValues.productId, productIds)),
      database
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.sortOrder)),
    ]);

    const categoryIds = [...new Set(categoryRows.map((row) => row.categoryId))];
    const attributeIds = [
      ...new Set(assignmentRows.map((row) => row.attributeId)),
    ];
    const valueIds = [...new Set(assignmentRows.map((row) => row.valueId))];
    const brandIds = [...new Set(rows.map((row) => row.brandId))];
    const [brandRows, categoryMetadata, attributeMetadata, valueMetadata] =
      await Promise.all([
        brandIds.length
          ? database.select().from(brands).where(inArray(brands.id, brandIds))
          : Promise.resolve([]),
        categoryIds.length
          ? database
              .select()
              .from(categories)
              .where(inArray(categories.id, categoryIds))
          : Promise.resolve([]),
        attributeIds.length
          ? database
              .select()
              .from(attributes)
              .where(inArray(attributes.id, attributeIds))
          : Promise.resolve([]),
        valueIds.length
          ? database
              .select()
              .from(attributeValues)
              .where(inArray(attributeValues.id, valueIds))
          : Promise.resolve([]),
      ]);

    const categoriesByProduct = new Map<string, string[]>();
    for (const category of categoryRows) {
      const categoryIds = categoriesByProduct.get(category.productId) ?? [];
      categoryIds.push(category.categoryId);
      categoriesByProduct.set(category.productId, categoryIds);
    }

    const assignmentsByProduct = new Map<string, Map<string, string[]>>();
    for (const assignment of assignmentRows) {
      const grouped =
        assignmentsByProduct.get(assignment.productId) ??
        new Map<string, string[]>();
      const values = grouped.get(assignment.attributeId) ?? [];
      values.push(assignment.valueId);
      grouped.set(assignment.attributeId, values);
      assignmentsByProduct.set(assignment.productId, grouped);
    }

    const imagesByProduct = new Map<string, ProductImageRow[]>();
    for (const image of imageRows) {
      const images = imagesByProduct.get(image.productId) ?? [];
      images.push(image);
      imagesByProduct.set(image.productId, images);
    }

    const brandById = new Map(brandRows.map((row) => [row.id, row]));
    const categoryById = new Map(categoryMetadata.map((row) => [row.id, row]));
    const attributeById = new Map(
      attributeMetadata.map((row) => [row.id, row]),
    );
    const valueById = new Map(valueMetadata.map((row) => [row.id, row]));
    const categoriesMetadataByProduct = new Map<string, CategoryRow[]>();
    for (const category of categoryRows) {
      const row = categoryById.get(category.categoryId);
      if (!row) continue;
      const productCategories =
        categoriesMetadataByProduct.get(category.productId) ?? [];
      productCategories.push(row);
      categoriesMetadataByProduct.set(category.productId, productCategories);
    }
    const attributesMetadataByProduct = new Map<string, AttributeRow[]>();
    const valuesMetadataByProduct = new Map<string, AttributeValueRow[]>();
    for (const assignment of assignmentRows) {
      const attribute = attributeById.get(assignment.attributeId);
      if (attribute) {
        const productAttributes =
          attributesMetadataByProduct.get(assignment.productId) ?? [];
        if (!productAttributes.some((item) => item.id === attribute.id)) {
          productAttributes.push(attribute);
        }
        attributesMetadataByProduct.set(
          assignment.productId,
          productAttributes,
        );
      }
      const value = valueById.get(assignment.valueId);
      if (value) {
        const productValues =
          valuesMetadataByProduct.get(assignment.productId) ?? [];
        if (!productValues.some((item) => item.id === value.id)) {
          productValues.push(value);
        }
        valuesMetadataByProduct.set(assignment.productId, productValues);
      }
    }

    return rows.map((row) => ({
      ...row,
      categoryIds: categoriesByProduct.get(row.id) ?? [],
      attributes: [
        ...(assignmentsByProduct.get(row.id) ?? new Map<string, string[]>()),
      ].map(([attributeId, valueIds]) => ({ attributeId, valueIds })),
      images: imagesByProduct.get(row.id) ?? [],
      enrichment: {
        brand: brandById.get(row.brandId),
        categories: categoriesMetadataByProduct.get(row.id) ?? [],
        attributes: attributesMetadataByProduct.get(row.id) ?? [],
        values: valuesMetadataByProduct.get(row.id) ?? [],
      },
    }));
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
      seoSlugCustom: input.seoSlugCustom,
      seoTitleCustom: input.seoTitleCustom,
      seoDescriptionCustom: input.seoDescriptionCustom,
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
    const rawRows = await database
      .select()
      .from(table)
      .where(where)
      .orderBy(order)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);
    const rawTotalRows = await database
      .select({ value: count() })
      .from(table)
      .where(where);
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
