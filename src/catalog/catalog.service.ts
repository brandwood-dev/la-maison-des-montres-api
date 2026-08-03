import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AttributeRow,
  AttributeValueRow,
  BrandRow,
  CategoryRow,
} from '../database/schema';
import { CATALOG_REPOSITORY } from './catalog.constants';
import type {
  CatalogRepository,
  PaginationInput,
  ProductDetail,
  ProductWrite,
} from './catalog.repository';
import type {
  CreateAttributeDto,
  CreateAttributeValueDto,
  CreateBrandDto,
  CreateCategoryDto,
  CreateProductDto,
  ListQueryDto,
  ProductListQueryDto,
  PublicProductListQueryDto,
  ReorderCategoriesDto,
  UpdateAttributeDto,
  UpdateAttributeValueDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repository: CatalogRepository,
  ) {}

  async listBrands(input: ListQueryDto) {
    const page = await this.repository.listBrands(this.pagination(input));
    return { ...page, data: page.data.map((row) => this.brandResponse(row)) };
  }

  async getBrand(id: string) {
    return this.brandResponse(await this.brandRow(id));
  }

  async createBrand(input: CreateBrandDto) {
    const row = await this.repository.createBrand({
      name: input.name.trim(),
      slug: input.slug ?? this.slugify(input.name),
      logoUrl: input.logoUrl ?? null,
      sortOrder: input.order ?? 0,
      seoTitle: input.seo?.title ?? null,
      seoDescription: input.seo?.description ?? null,
      active: input.active ?? true,
    });
    return this.brandResponse(row);
  }

  async updateBrand(id: string, input: UpdateBrandDto) {
    await this.brandRow(id);
    const row = await this.repository.updateBrand(id, {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.slug
        ? { slug: input.slug }
        : input.name
          ? { slug: this.slugify(input.name) }
          : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.order !== undefined ? { sortOrder: input.order } : {}),
      ...(input.seo
        ? {
            seoTitle: input.seo.title ?? null,
            seoDescription: input.seo.description ?? null,
          }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return this.brandResponse(this.require(row, 'Brand'));
  }

  async deleteBrand(id: string): Promise<void> {
    if (!(await this.repository.deleteBrand(id))) {
      throw new NotFoundException('Brand not found');
    }
  }

  async listCategories(input: ListQueryDto) {
    const page = await this.repository.listCategories(this.pagination(input));
    return {
      ...page,
      data: page.data.map((row) => this.categoryResponse(row)),
    };
  }

  async getCategory(id: string) {
    return this.categoryResponse(await this.categoryRow(id));
  }

  async createCategory(input: CreateCategoryDto) {
    if (input.parentId) await this.categoryRow(input.parentId);
    const row = await this.repository.createCategory({
      name: input.name.trim(),
      slug: input.slug ?? this.slugify(input.name),
      parentId: input.parentId ?? null,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      sortOrder: input.order ?? 0,
      seoTitle: input.seo?.title ?? null,
      seoDescription: input.seo?.description ?? null,
      active: input.active ?? true,
    });
    return this.categoryResponse(row);
  }

  async updateCategory(id: string, input: UpdateCategoryDto) {
    await this.categoryRow(id);
    if (input.parentId === id) {
      throw new BadRequestException('A category cannot be its own parent');
    }
    if (input.parentId) await this.assertNoCategoryCycle(id, input.parentId);
    const row = await this.repository.updateCategory(id, {
      ...(input.name ? { name: input.name.trim() } : {}),
      ...(input.slug
        ? { slug: input.slug }
        : input.name
          ? { slug: this.slugify(input.name) }
          : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.order !== undefined ? { sortOrder: input.order } : {}),
      ...(input.seo
        ? {
            seoTitle: input.seo.title ?? null,
            seoDescription: input.seo.description ?? null,
          }
        : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return this.categoryResponse(this.require(row, 'Category'));
  }

  async deleteCategory(id: string): Promise<void> {
    if (!(await this.repository.deleteCategory(id))) {
      throw new NotFoundException('Category not found');
    }
  }

  async reorderCategories(input: ReorderCategoriesDto) {
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('A category can appear only once');
    }
    await Promise.all(ids.map((id) => this.categoryRow(id)));
    const rows = await Promise.all(
      input.items.map((item) =>
        this.repository.updateCategory(item.id, { sortOrder: item.order }),
      ),
    );
    return rows.map((row) =>
      this.categoryResponse(this.require(row, 'Category')),
    );
  }

  async listAttributes(input: ListQueryDto) {
    const page = await this.repository.listAttributes(this.pagination(input));
    const data = [];
    for (const row of page.data) {
      data.push(await this.attributeResponse(row));
    }
    return { ...page, data };
  }

  async getAttribute(id: string) {
    return this.attributeResponse(await this.attributeRow(id));
  }

  async createAttribute(input: CreateAttributeDto) {
    const row = await this.repository.createAttribute({
      name: input.label.trim(),
      slug: input.code,
      type: input.type,
      filterable: input.visibleInFilters ?? false,
      sortOrder: input.order ?? 0,
      active: input.active ?? true,
    });
    return this.attributeResponse(row);
  }

  async updateAttribute(id: string, input: UpdateAttributeDto) {
    await this.attributeRow(id);
    const row = await this.repository.updateAttribute(id, {
      ...(input.label ? { name: input.label.trim() } : {}),
      ...(input.code ? { slug: input.code } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.visibleInFilters !== undefined
        ? { filterable: input.visibleInFilters }
        : {}),
      ...(input.order !== undefined ? { sortOrder: input.order } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return this.attributeResponse(this.require(row, 'Attribute'));
  }

  async deleteAttribute(id: string): Promise<void> {
    if (!(await this.repository.deleteAttribute(id))) {
      throw new NotFoundException('Attribute not found');
    }
  }

  async listAttributeValues(attributeId: string) {
    await this.attributeRow(attributeId);
    const rows = await this.repository.listAttributeValues(attributeId);
    return rows.map((row) => this.attributeValueResponse(row));
  }

  async getAttributeValue(id: string) {
    return this.attributeValueResponse(await this.attributeValueRow(id));
  }

  async createAttributeValue(
    attributeId: string,
    input: CreateAttributeValueDto,
  ) {
    const attribute = await this.attributeRow(attributeId);
    this.assertSwatch(attribute.type, input.swatch);
    const row = await this.repository.createAttributeValue({
      attributeId,
      label: input.label.trim(),
      slug: input.slug ?? this.slugify(input.label),
      swatch: input.swatch ?? null,
      imageUrl: input.imageUrl ?? null,
      sortOrder: input.order ?? 0,
      active: input.active ?? true,
    });
    return this.attributeValueResponse(row);
  }

  async updateAttributeValue(id: string, input: UpdateAttributeValueDto) {
    const value = await this.attributeValueRow(id);
    const attribute = await this.attributeRow(value.attributeId);
    this.assertSwatch(
      attribute.type,
      input.swatch ?? value.swatch ?? undefined,
    );
    const row = await this.repository.updateAttributeValue(id, {
      ...(input.label ? { label: input.label.trim() } : {}),
      ...(input.slug
        ? { slug: input.slug }
        : input.label
          ? { slug: this.slugify(input.label) }
          : {}),
      ...(input.swatch !== undefined ? { swatch: input.swatch } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.order !== undefined ? { sortOrder: input.order } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    });
    return this.attributeValueResponse(this.require(row, 'Attribute value'));
  }

  async deleteAttributeValue(id: string): Promise<void> {
    if (!(await this.repository.deleteAttributeValue(id))) {
      throw new NotFoundException('Attribute value not found');
    }
  }

  async listProducts(input: ProductListQueryDto) {
    const page = await this.repository.listProducts({
      ...this.pagination(input),
      brandId: input.brandId,
      categoryId: input.categoryId,
      status: input.status,
    });
    const data = [];
    for (const item of page.data) {
      data.push(await this.productResponse(item));
    }
    return { ...page, data };
  }

  async getProduct(id: string) {
    return this.productResponse(await this.productRow(id));
  }

  async listPublicBrands(input: ListQueryDto) {
    return this.listBrands({ ...input, active: true });
  }

  async listPublicCategories(input: ListQueryDto) {
    return this.listCategories({ ...input, active: true });
  }

  async listPublicProducts(input: PublicProductListQueryDto) {
    const page = await this.repository.listProducts({
      ...this.pagination(input),
      status: 'published',
      availableOnly: true,
      brandId: input.brandId,
      categoryId: input.categoryId,
      minPrice: input.minPrice,
      maxPrice: input.maxPrice,
    });
    const data = [];
    for (const item of page.data) {
      data.push(await this.publicProductResponse(item));
    }
    return { ...page, data };
  }

  async getPublicProduct(slug: string) {
    const product = this.require(
      await this.repository.findProductBySlug(slug),
      'Product',
    );
    if (product.status !== 'published' || product.stock <= 0) {
      throw new NotFoundException('Product not found');
    }
    return this.publicProductResponse(product);
  }

  async createProduct(input: CreateProductDto) {
    const write = this.productInput(input);
    this.validatePromotion(write);
    await this.validateProduct(write);
    return this.productResponse(await this.repository.createProduct(write));
  }

  async updateProduct(id: string, input: UpdateProductDto) {
    const current = await this.productRow(id);
    const patch = this.productPatch(input);
    const merged: ProductWrite = {
      brandId: patch.brandId ?? current.brandId,
      name: patch.name ?? current.name,
      reference: patch.reference ?? current.reference,
      description: patch.description ?? current.description,
      price: patch.price ?? current.price,
      oldPrice:
        patch.oldPrice !== undefined ? patch.oldPrice : current.oldPrice,
      stock: patch.stock ?? current.stock,
      promotionActive: patch.promotionActive ?? current.promotionActive,
      promotionStartsAt:
        patch.promotionStartsAt !== undefined
          ? patch.promotionStartsAt
          : current.promotionStartsAt,
      promotionEndsAt:
        patch.promotionEndsAt !== undefined
          ? patch.promotionEndsAt
          : current.promotionEndsAt,
      status: patch.status ?? current.status,
      seoSlug: patch.seoSlug ?? current.seoSlug,
      seoTitle:
        patch.seoTitle !== undefined ? patch.seoTitle : current.seoTitle,
      seoDescription:
        patch.seoDescription !== undefined
          ? patch.seoDescription
          : current.seoDescription,
      categoryIds: patch.categoryIds ?? current.categoryIds,
      attributes: patch.attributes ?? current.attributes,
      images:
        patch.images ??
        current.images.map((image) => ({
          url: image.url,
          alt: image.alt,
          mediaProvider: image.mediaProvider,
          mediaKey: image.mediaKey,
          sortOrder: image.sortOrder,
        })),
    };
    this.validatePromotion(merged);
    await this.validateProduct(merged);
    const updated = await this.repository.updateProduct(id, patch);
    return this.productResponse(this.require(updated, 'Product'));
  }

  async deleteProduct(id: string): Promise<void> {
    if (!(await this.repository.deleteProduct(id))) {
      throw new NotFoundException('Product not found');
    }
  }

  private async validateProduct(input: ProductWrite): Promise<void> {
    await this.brandRow(input.brandId);
    await Promise.all(input.categoryIds.map((id) => this.categoryRow(id)));
    const attributeIds = input.attributes.map((item) => item.attributeId);
    if (new Set(attributeIds).size !== attributeIds.length) {
      throw new BadRequestException('Each attribute can be assigned only once');
    }
    for (const assignment of input.attributes) {
      const attribute = await this.attributeRow(assignment.attributeId);
      if (
        attribute.type !== 'multiselect' &&
        assignment.valueIds.length !== 1
      ) {
        throw new BadRequestException(
          `Attribute ${attribute.slug} accepts exactly one value`,
        );
      }
      for (const valueId of assignment.valueIds) {
        const value = await this.attributeValueRow(valueId);
        if (value.attributeId !== attribute.id) {
          throw new BadRequestException(
            `Value ${valueId} does not belong to attribute ${attribute.slug}`,
          );
        }
      }
    }
  }

  private productInput(input: CreateProductDto): ProductWrite {
    return {
      brandId: input.brandId,
      name: input.name,
      reference: input.reference,
      description: input.description,
      price: input.price,
      oldPrice: input.oldPrice ?? null,
      stock: input.stock ?? 0,
      promotionActive: input.promotion?.active ?? false,
      promotionStartsAt: input.promotion?.startsAt
        ? new Date(input.promotion.startsAt)
        : null,
      promotionEndsAt: input.promotion?.endsAt
        ? new Date(input.promotion.endsAt)
        : null,
      status: input.status ?? 'draft',
      seoSlug: input.seo?.slug ?? this.slugify(input.name),
      seoTitle: input.seo?.title ?? null,
      seoDescription: input.seo?.description ?? null,
      categoryIds: input.categoryIds,
      attributes: input.attributes,
      images: input.images.map((image) => ({
        url: image.url,
        alt: image.alt ?? null,
        mediaProvider: image.mediaProvider ?? null,
        mediaKey: image.mediaKey ?? null,
        sortOrder: image.order ?? 0,
      })),
    } satisfies ProductWrite;
  }

  private productPatch(input: UpdateProductDto): Partial<ProductWrite> {
    return {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.brandId !== undefined ? { brandId: input.brandId } : {}),
      ...(input.reference !== undefined ? { reference: input.reference } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.oldPrice !== undefined ? { oldPrice: input.oldPrice } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.promotion
        ? {
            promotionActive: input.promotion.active,
            promotionStartsAt: input.promotion.startsAt
              ? new Date(input.promotion.startsAt)
              : null,
            promotionEndsAt: input.promotion.endsAt
              ? new Date(input.promotion.endsAt)
              : null,
          }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.seo
        ? {
            ...(input.seo.slug ? { seoSlug: input.seo.slug } : {}),
            seoTitle: input.seo.title ?? null,
            seoDescription: input.seo.description ?? null,
          }
        : {}),
      ...(input.categoryIds ? { categoryIds: input.categoryIds } : {}),
      ...(input.attributes ? { attributes: input.attributes } : {}),
      ...(input.images
        ? {
            images: input.images.map((image) => ({
              url: image.url,
              alt: image.alt ?? null,
              mediaProvider: image.mediaProvider ?? null,
              mediaKey: image.mediaKey ?? null,
              sortOrder: image.order ?? 0,
            })),
          }
        : {}),
    };
  }

  private brandResponse(row: BrandRow) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      logoUrl: row.logoUrl ?? undefined,
      active: row.active,
      order: row.sortOrder,
      seo: {
        title: row.seoTitle ?? undefined,
        description: row.seoDescription ?? undefined,
      },
    };
  }

  private categoryResponse(row: CategoryRow) {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      parentId: row.parentId,
      order: row.sortOrder,
      active: row.active,
      seo: {
        title: row.seoTitle ?? undefined,
        description: row.seoDescription ?? undefined,
      },
    };
  }

  private async attributeResponse(row: AttributeRow) {
    const values = await this.repository.listAttributeValues(row.id);
    return {
      id: row.id,
      code: row.slug,
      label: row.name,
      type: row.type,
      visibleInFilters: row.filterable,
      active: row.active,
      order: row.sortOrder,
      values: values.map((value) => this.attributeValueResponse(value)),
    };
  }

  private attributeValueResponse(row: AttributeValueRow) {
    return {
      id: row.id,
      attributeId: row.attributeId,
      label: row.label,
      slug: row.slug,
      swatch: row.swatch ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      order: row.sortOrder,
      active: row.active,
    };
  }

  private async productResponse(product: ProductDetail) {
    const brand = await this.brandRow(product.brandId);
    const effective = this.isPromotionEffective(product);
    return {
      id: product.id,
      name: product.name,
      brandId: product.brandId,
      brand: brand.name,
      reference: product.reference,
      description: product.description,
      price: product.price,
      oldPrice: product.oldPrice ?? undefined,
      promotion: {
        active: product.promotionActive,
        startsAt: product.promotionStartsAt?.toISOString(),
        endsAt: product.promotionEndsAt?.toISOString(),
        effective,
        discountPct:
          effective && product.oldPrice
            ? Math.round(
                ((product.oldPrice - product.price) / product.oldPrice) * 100,
              )
            : undefined,
      },
      finalPrice: product.price,
      stock: product.stock,
      available: product.status === 'published' && product.stock > 0,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt ?? undefined,
        order: image.sortOrder,
      })),
      categoryIds: product.categoryIds,
      attributes: product.attributes,
      status: product.status,
      seo: {
        slug: product.seoSlug,
        title: product.seoTitle ?? undefined,
        description: product.seoDescription ?? undefined,
      },
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private async publicProductResponse(product: ProductDetail) {
    const adminProduct = await this.productResponse(product);
    const publicAttributes = [];
    for (const assignment of product.attributes) {
      const attribute = await this.repository.findAttribute(
        assignment.attributeId,
      );
      if (!attribute || !attribute.active) continue;
      const values = [];
      for (const valueId of assignment.valueIds) {
        const value = await this.repository.findAttributeValue(valueId);
        if (!value || !value.active) continue;
        values.push({
          id: value.id,
          label: value.label,
          slug: value.slug,
          ...(value.swatch ? { swatch: value.swatch } : {}),
          ...(value.imageUrl ? { imageUrl: value.imageUrl } : {}),
        });
      }
      if (values.length > 0) {
        publicAttributes.push({
          id: attribute.id,
          code: attribute.slug,
          label: attribute.name,
          type: attribute.type,
          values,
        });
      }
    }
    const categories = [];
    for (const id of product.categoryIds) {
      categories.push(await this.categoryRow(id));
    }
    const category = this.publicCategory(
      categories.filter((item) => item.active).map((item) => item.slug),
    );
    return {
      id: adminProduct.id,
      slug: adminProduct.seo.slug,
      name: adminProduct.name,
      brand: adminProduct.brand,
      reference: adminProduct.reference,
      category,
      currency: 'TND' as const,
      regularPriceMillimes:
        adminProduct.promotion.effective && adminProduct.oldPrice
          ? adminProduct.oldPrice
          : adminProduct.price,
      promotion:
        adminProduct.promotion.effective &&
        adminProduct.oldPrice &&
        adminProduct.promotion.endsAt
          ? {
              regularPriceMillimes: adminProduct.oldPrice,
              salePriceMillimes: adminProduct.price,
              startsAt: adminProduct.promotion.startsAt ?? null,
              endsAt: adminProduct.promotion.endsAt,
            }
          : null,
      availability: adminProduct.available ? 'available' : 'unavailable',
      images: adminProduct.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt ?? adminProduct.name,
        position: image.order + 1,
      })),
      attributes: publicAttributes,
      shortDescription: adminProduct.description,
      dialColor: null,
      braceletMaterial: null,
      braceletColor: null,
      movementType: null,
      displayType: null,
      diameterMm: null,
      glassType: null,
      waterResistance: null,
      warrantyMonths: null,
      giftBoxIncluded: categories.some(
        (item) => item.slug === 'coffrets' || item.slug === 'coffrets-cadeaux',
      ),
      isNew: false,
      isBestSeller: false,
    };
  }

  private isPromotionEffective(product: ProductDetail, now = new Date()) {
    return Boolean(
      product.promotionActive &&
      product.oldPrice &&
      product.oldPrice > product.price &&
      product.promotionEndsAt &&
      (!product.promotionStartsAt || product.promotionStartsAt <= now) &&
      product.promotionEndsAt > now,
    );
  }

  private validatePromotion(product: ProductWrite): void {
    if (!product.promotionActive) return;
    if (
      !product.oldPrice ||
      product.oldPrice <= product.price ||
      !product.promotionEndsAt
    ) {
      throw new BadRequestException(
        'An active promotion requires an oldPrice greater than price and an end date',
      );
    }
    if (
      product.promotionStartsAt &&
      product.promotionStartsAt >= product.promotionEndsAt
    ) {
      throw new BadRequestException(
        'Promotion start date must be before end date',
      );
    }
  }

  private publicCategory(slugs: string[]) {
    const aliases: Record<
      string,
      'men' | 'women' | 'children' | 'couple' | 'connected'
    > = {
      homme: 'men',
      hommes: 'men',
      femme: 'women',
      femmes: 'women',
      enfant: 'children',
      enfants: 'children',
      couple: 'couple',
      connectees: 'connected',
      'montres-connectees': 'connected',
    };
    return slugs.map((slug) => aliases[slug]).find(Boolean) ?? 'men';
  }

  private pagination(input: ListQueryDto): PaginationInput {
    const [sortBy, parsedOrder] = input.sort?.split(':') ?? [];
    return {
      page: input.page,
      pageSize: input.pageSize,
      q: input.query ?? input.q,
      sortBy: sortBy || input.sortBy,
      sortOrder:
        parsedOrder === 'asc' || parsedOrder === 'desc'
          ? parsedOrder
          : input.sortOrder,
      active: input.active,
    };
  }

  private async brandRow(id: string): Promise<BrandRow> {
    return this.require(await this.repository.findBrand(id), 'Brand');
  }

  private async categoryRow(id: string): Promise<CategoryRow> {
    return this.require(await this.repository.findCategory(id), 'Category');
  }

  private async attributeRow(id: string): Promise<AttributeRow> {
    return this.require(await this.repository.findAttribute(id), 'Attribute');
  }

  private async attributeValueRow(id: string): Promise<AttributeValueRow> {
    return this.require(
      await this.repository.findAttributeValue(id),
      'Attribute value',
    );
  }

  private async productRow(id: string): Promise<ProductDetail> {
    return this.require(await this.repository.findProduct(id), 'Product');
  }

  private assertSwatch(type: string, swatch: string | undefined): void {
    if (type === 'color' && !swatch) {
      throw new BadRequestException(
        'A color attribute value requires a swatch',
      );
    }
  }

  private async assertNoCategoryCycle(
    categoryId: string,
    parentId: string,
  ): Promise<void> {
    const visited = new Set<string>([categoryId]);
    let currentId: string | null = parentId;
    while (currentId) {
      if (visited.has(currentId)) {
        throw new BadRequestException('Category hierarchy contains a cycle');
      }
      visited.add(currentId);
      currentId = (await this.categoryRow(currentId)).parentId;
    }
  }

  private require<T>(value: T | null, name: string): T {
    if (!value) throw new NotFoundException(`${name} not found`);
    return value;
  }

  private slugify(value: string): string {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('Cannot derive a valid slug');
    return slug;
  }
}
