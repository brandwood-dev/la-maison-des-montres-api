import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CATALOG_REPOSITORY } from '../catalog/catalog.constants';
import type {
  CatalogRepository,
  ProductDetail,
} from '../catalog/catalog.repository';

const FEED_PAGE_SIZE = 100;
const GOOGLE_PRODUCT_CATEGORY = 'Apparel & Accessories > Jewelry > Watches';
const FEED_HEADERS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'product_type',
  'google_product_category',
  'sale_price',
  'sale_price_effective_date',
  'item_group_id',
] as const;

@Injectable()
export class MetaFeedService {
  constructor(
    @Inject(CATALOG_REPOSITORY)
    private readonly repository: CatalogRepository,
    private readonly config: ConfigService,
  ) {}

  async generateCsv(now = new Date()): Promise<string> {
    const products = await this.publishedProducts();
    const rows = products.map((product) => this.productRow(product, now));
    return (
      [FEED_HEADERS.join(','), ...rows.map((row) => row.join(','))].join(
        '\r\n',
      ) + '\r\n'
    );
  }

  private async publishedProducts(): Promise<ProductDetail[]> {
    const products: ProductDetail[] = [];
    let page = 1;

    while (true) {
      const result = await this.repository.listProducts({
        page,
        pageSize: FEED_PAGE_SIZE,
        sortOrder: 'asc',
        sortBy: 'createdAt',
        status: 'published',
      });
      products.push(...result.data);
      if (
        result.data.length === 0 ||
        products.length >= result.total ||
        result.data.length < FEED_PAGE_SIZE
      ) {
        return products;
      }
      page += 1;
    }
  }

  private productRow(product: ProductDetail, now: Date): string[] {
    const images = product.images
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => image.url)
      .filter((url) => this.isHttpsUrl(url));
    const promotionActive = this.isPromotionActive(product, now);
    const promotionStart = product.promotionStartsAt ?? now;
    const categories = product.enrichment?.categories ?? [];
    const category = categories.find((item) => item.active) ?? categories[0];
    const siteUrl = this.siteUrl();

    return FEED_HEADERS.map((header) => {
      switch (header) {
        case 'id':
          return this.csv(product.id);
        case 'title':
          return this.csv(product.name);
        case 'description':
          return this.csv(product.description);
        case 'availability':
          return this.csv(product.stock > 0 ? 'in stock' : 'out of stock');
        case 'condition':
          return this.csv('new');
        case 'price':
          return this.csv(
            this.price(
              promotionActive && product.oldPrice !== null
                ? product.oldPrice
                : product.price,
            ),
          );
        case 'link':
          return this.csv(
            `${siteUrl}/montres/${encodeURIComponent(product.seoSlug)}`,
          );
        case 'image_link':
          return this.csv(images[0] ?? '');
        case 'additional_image_link':
          return this.csv(images.slice(1).join(','));
        case 'brand':
          return this.csv(product.enrichment?.brand?.name ?? '');
        case 'product_type':
          return this.csv(category?.name ?? category?.slug ?? '');
        case 'google_product_category':
          return this.csv(GOOGLE_PRODUCT_CATEGORY);
        case 'sale_price':
          return this.csv(promotionActive ? this.price(product.price) : '');
        case 'sale_price_effective_date':
          return this.csv(
            promotionActive
              ? `${promotionStart.toISOString()}/${product.promotionEndsAt!.toISOString()}`
              : '',
          );
        case 'item_group_id':
          return this.csv('');
      }
    });
  }

  private siteUrl(): string {
    const value =
      this.config.get<string>('PUBLIC_SITE_URL') ??
      'https://lamaisondesmontres.com';
    return value.replace(/\/+$/, '');
  }

  private price(millimes: number): string {
    return `${(millimes / 1000).toFixed(3)} TND`;
  }

  private isPromotionActive(product: ProductDetail, now: Date): boolean {
    return Boolean(
      product.promotionActive &&
      product.oldPrice !== null &&
      product.oldPrice > product.price &&
      product.promotionEndsAt &&
      (!product.promotionStartsAt || product.promotionStartsAt <= now) &&
      product.promotionEndsAt > now,
    );
  }

  private isHttpsUrl(value: string): boolean {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }

  private csv(value: string): string {
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
}
