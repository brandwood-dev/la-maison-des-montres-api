import { randomUUID } from 'node:crypto';
import type { AuthRepository } from '../../src/auth/auth.repository';
import type {
  CatalogRepository,
  Page,
  PaginationInput,
  ProductDetail,
  ProductListInput,
  ProductWrite,
} from '../../src/catalog/catalog.repository';
import type {
  AdminSessionRow,
  AdminUserRow,
  AttributeRow,
  AttributeValueRow,
  BrandRow,
  CategoryRow,
} from '../../src/database/schema';

export class FakeAuthRepository implements AuthRepository {
  readonly users: AdminUserRow[] = [];
  readonly sessions = new Map<string, AdminSessionRow>();

  findUserByEmail(email: string): Promise<AdminUserRow | null> {
    return Promise.resolve(
      this.users.find(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      ) ?? null,
    );
  }

  findUserById(id: string): Promise<AdminUserRow | null> {
    return Promise.resolve(this.users.find((user) => user.id === id) ?? null);
  }

  touchLastLogin(id: string, at: Date): Promise<void> {
    const user = this.users.find((item) => item.id === id);
    if (user) user.lastLoginAt = at;
    return Promise.resolve();
  }

  createSession(input: {
    id: string;
    adminUserId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    this.sessions.set(input.id, {
      ...input,
      revokedAt: null,
      lastUsedAt: null,
      createdAt: new Date(),
    });
    return Promise.resolve();
  }

  findSession(id: string): Promise<AdminSessionRow | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  rotateSession(id: string, tokenHash: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      session.tokenHash = tokenHash;
      session.lastUsedAt = at;
    }
    return Promise.resolve();
  }

  revokeSession(id: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session) session.revokedAt = at;
    return Promise.resolve();
  }
}

export class FakeCatalogRepository implements CatalogRepository {
  readonly brands: BrandRow[] = [];
  readonly categories: CategoryRow[] = [];
  readonly attributes: AttributeRow[] = [];
  readonly values: AttributeValueRow[] = [];
  readonly products: ProductDetail[] = [];

  listBrands(input: PaginationInput): Promise<Page<BrandRow>> {
    return Promise.resolve(this.list(this.brands, input));
  }

  findBrand(id: string): Promise<BrandRow | null> {
    return Promise.resolve(this.brands.find((item) => item.id === id) ?? null);
  }

  createBrand(
    input: Omit<BrandRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<BrandRow> {
    const row = { ...input, ...this.identity() };
    this.brands.push(row);
    return Promise.resolve(row);
  }

  updateBrand(
    id: string,
    input: Partial<Omit<BrandRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<BrandRow | null> {
    return Promise.resolve(this.update(this.brands, id, input));
  }

  deleteBrand(id: string): Promise<boolean> {
    return Promise.resolve(this.remove(this.brands, id));
  }

  listCategories(input: PaginationInput): Promise<Page<CategoryRow>> {
    return Promise.resolve(this.list(this.categories, input));
  }

  findCategory(id: string): Promise<CategoryRow | null> {
    return Promise.resolve(
      this.categories.find((item) => item.id === id) ?? null,
    );
  }

  createCategory(
    input: Omit<CategoryRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CategoryRow> {
    const row = { ...input, ...this.identity() };
    this.categories.push(row);
    return Promise.resolve(row);
  }

  updateCategory(
    id: string,
    input: Partial<Omit<CategoryRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<CategoryRow | null> {
    return Promise.resolve(this.update(this.categories, id, input));
  }

  deleteCategory(id: string): Promise<boolean> {
    return Promise.resolve(this.remove(this.categories, id));
  }

  listAttributes(input: PaginationInput): Promise<Page<AttributeRow>> {
    return Promise.resolve(this.list(this.attributes, input));
  }

  findAttribute(id: string): Promise<AttributeRow | null> {
    return Promise.resolve(
      this.attributes.find((item) => item.id === id) ?? null,
    );
  }

  createAttribute(
    input: Omit<AttributeRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AttributeRow> {
    const row = { ...input, ...this.identity() };
    this.attributes.push(row);
    return Promise.resolve(row);
  }

  updateAttribute(
    id: string,
    input: Partial<Omit<AttributeRow, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<AttributeRow | null> {
    return Promise.resolve(this.update(this.attributes, id, input));
  }

  deleteAttribute(id: string): Promise<boolean> {
    return Promise.resolve(this.remove(this.attributes, id));
  }

  listAttributeValues(attributeId: string): Promise<AttributeValueRow[]> {
    return Promise.resolve(
      this.values.filter((item) => item.attributeId === attributeId),
    );
  }

  findAttributeValue(id: string): Promise<AttributeValueRow | null> {
    return Promise.resolve(this.values.find((item) => item.id === id) ?? null);
  }

  createAttributeValue(
    input: Omit<AttributeValueRow, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<AttributeValueRow> {
    const row = { ...input, ...this.identity() };
    this.values.push(row);
    return Promise.resolve(row);
  }

  updateAttributeValue(
    id: string,
    input: Partial<
      Omit<AttributeValueRow, 'id' | 'attributeId' | 'createdAt' | 'updatedAt'>
    >,
  ): Promise<AttributeValueRow | null> {
    return Promise.resolve(this.update(this.values, id, input));
  }

  deleteAttributeValue(id: string): Promise<boolean> {
    return Promise.resolve(this.remove(this.values, id));
  }

  listProducts(input: ProductListInput): Promise<Page<ProductDetail>> {
    const filtered = this.products.filter(
      (item) =>
        (!input.brandId || item.brandId === input.brandId) &&
        (!input.categoryId || item.categoryIds.includes(input.categoryId)) &&
        (!input.status || item.status === input.status) &&
        (!input.availableOnly || item.stock > 0) &&
        (input.minPrice === undefined || item.price >= input.minPrice) &&
        (input.maxPrice === undefined || item.price <= input.maxPrice),
    );
    return Promise.resolve(this.list(filtered, input));
  }

  findProduct(id: string): Promise<ProductDetail | null> {
    return Promise.resolve(
      this.products.find((item) => item.id === id) ?? null,
    );
  }

  findProductBySlug(slug: string): Promise<ProductDetail | null> {
    return Promise.resolve(
      this.products.find((item) => item.seoSlug === slug) ?? null,
    );
  }

  createProduct(input: ProductWrite): Promise<ProductDetail> {
    const now = new Date();
    const row: ProductDetail = {
      id: randomUUID(),
      brandId: input.brandId,
      name: input.name,
      reference: input.reference,
      description: input.description,
      price: input.price,
      oldPrice: input.oldPrice ?? null,
      stock: input.stock,
      promotionActive: input.promotionActive,
      promotionStartsAt: input.promotionStartsAt ?? null,
      promotionEndsAt: input.promotionEndsAt ?? null,
      status: input.status ?? 'draft',
      seoSlug: input.seoSlug,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      createdAt: now,
      updatedAt: now,
      categoryIds: [...input.categoryIds],
      attributes: structuredClone(input.attributes),
      images: input.images.map((image) => ({
        id: randomUUID(),
        productId: '',
        mediaProvider: image.mediaProvider ?? null,
        mediaKey: image.mediaKey ?? null,
        url: image.url,
        alt: image.alt ?? null,
        sortOrder: image.sortOrder ?? 0,
        createdAt: now,
      })),
    };
    row.images.forEach((image) => (image.productId = row.id));
    this.products.push(row);
    return Promise.resolve(row);
  }

  updateProduct(
    id: string,
    input: Partial<ProductWrite>,
  ): Promise<ProductDetail | null> {
    const row = this.products.find((item) => item.id === id);
    if (!row) return Promise.resolve(null);
    Object.assign(row, input, { updatedAt: new Date() });
    if (input.images) {
      row.images = input.images.map((image) => ({
        id: randomUUID(),
        productId: id,
        mediaProvider: image.mediaProvider ?? null,
        mediaKey: image.mediaKey ?? null,
        url: image.url,
        alt: image.alt ?? null,
        sortOrder: image.sortOrder ?? 0,
        createdAt: new Date(),
      }));
    }
    return Promise.resolve(row);
  }

  deleteProduct(id: string): Promise<boolean> {
    return Promise.resolve(this.remove(this.products, id));
  }

  private identity() {
    const now = new Date();
    return { id: randomUUID(), createdAt: now, updatedAt: now };
  }

  private list<T extends { name?: string }>(
    rows: T[],
    input: PaginationInput,
  ): Page<T> {
    const q = input.q?.toLowerCase();
    const filtered = q
      ? rows.filter((item) => item.name?.toLowerCase().includes(q))
      : rows;
    const start = (input.page - 1) * input.pageSize;
    return {
      data: filtered.slice(start, start + input.pageSize),
      page: input.page,
      pageSize: input.pageSize,
      total: filtered.length,
    };
  }

  private update<T extends { id: string; updatedAt: Date }>(
    rows: T[],
    id: string,
    input: object,
  ): T | null {
    const row = rows.find((item) => item.id === id);
    if (!row) return null;
    Object.assign(row, input, { updatedAt: new Date() });
    return row;
  }

  private remove<T extends { id: string }>(rows: T[], id: string): boolean {
    const index = rows.findIndex((item) => item.id === id);
    if (index < 0) return false;
    rows.splice(index, 1);
    return true;
  }
}
