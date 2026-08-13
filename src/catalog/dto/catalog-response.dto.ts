import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { attributeTypes, productStatuses } from './catalog.dto';

export class SeoResponseDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ readOnly: true })
  slugCustom?: boolean;

  @ApiPropertyOptional({ readOnly: true })
  titleCustom?: boolean;

  @ApiPropertyOptional({ readOnly: true })
  descriptionCustom?: boolean;
}

export class ProductSeoResponseDto extends SeoResponseDto {
  @ApiProperty()
  slug!: string;
}

export class BrandResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ format: 'uri' })
  logoUrl?: string;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ minimum: 0 })
  order!: number;

  @ApiProperty({ type: SeoResponseDto })
  seo!: SeoResponseDto;
}

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ readOnly: true })
  slugCustom?: boolean;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ format: 'uri' })
  imageUrl?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  parentId?: string | null;

  @ApiProperty({ minimum: 0 })
  order!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ type: SeoResponseDto })
  seo!: SeoResponseDto;

  @ApiPropertyOptional({ minimum: 0, readOnly: true })
  productsCount?: number;
}

export class AttributeValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  attributeId!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional({ pattern: '^#[0-9a-fA-F]{6}$' })
  swatch?: string;

  @ApiPropertyOptional({ format: 'uri' })
  imageUrl?: string;

  @ApiProperty({ minimum: 0 })
  order!: number;

  @ApiProperty()
  active!: boolean;
}

export class AttributeResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty({ enum: attributeTypes })
  type!: (typeof attributeTypes)[number];

  @ApiProperty()
  visibleInFilters!: boolean;

  @ApiProperty()
  active!: boolean;

  @ApiProperty({ minimum: 0 })
  order!: number;

  @ApiProperty({ type: AttributeValueResponseDto, isArray: true })
  values!: AttributeValueResponseDto[];
}

export class ProductImageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uri' })
  url!: string;

  @ApiPropertyOptional()
  alt?: string;

  @ApiPropertyOptional({ format: 'uri', description: 'URL WebP optimisée' })
  optimizedUrl?: string;

  @ApiPropertyOptional({ description: 'Variantes WebP responsive' })
  srcSet?: string;

  @ApiPropertyOptional({ description: 'Tailles responsives recommandées' })
  sizes?: string;

  @ApiProperty({ minimum: 0 })
  order!: number;
}

export class ProductAttributeAssignmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  attributeId!: string;

  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  valueIds!: string[];
}

export class ProductPromotionResponseDto {
  @ApiProperty()
  active!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  startsAt?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  endsAt?: string;

  @ApiPropertyOptional({ readOnly: true })
  effective?: boolean;

  @ApiPropertyOptional({ readOnly: true })
  discountPct?: number;
}

export class ProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'uuid' })
  brandId!: string;

  @ApiProperty()
  brand!: string;

  @ApiPropertyOptional({ format: 'uri' })
  brandLogoUrl?: string;

  @ApiProperty()
  reference!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  shortDescription?: string;

  @ApiProperty({ type: Number, minimum: 0, description: 'Integer millimes' })
  price!: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    description: 'Integer millimes',
  })
  oldPrice?: number;

  @ApiProperty({ type: ProductPromotionResponseDto })
  promotion!: ProductPromotionResponseDto;

  @ApiProperty({
    type: Number,
    minimum: 0,
    readOnly: true,
    description: 'Integer millimes',
  })
  finalPrice!: number;

  @ApiProperty({ type: Number, readOnly: true })
  stock!: number;

  @ApiProperty()
  isBestSeller!: boolean;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiProperty({ readOnly: true })
  available!: boolean;

  @ApiProperty({ type: ProductImageResponseDto, isArray: true })
  images!: ProductImageResponseDto[];

  @ApiProperty({ type: String, format: 'uuid', isArray: true })
  categoryIds!: string[];

  @ApiProperty({
    type: ProductAttributeAssignmentResponseDto,
    isArray: true,
  })
  attributes!: ProductAttributeAssignmentResponseDto[];

  @ApiProperty({ enum: productStatuses })
  status!: (typeof productStatuses)[number];

  @ApiProperty({ type: ProductSeoResponseDto })
  seo!: ProductSeoResponseDto;

  @ApiProperty({ type: String, format: 'date-time', readOnly: true })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time', readOnly: true })
  updatedAt!: string;
}

class PaginatedResponseDto {
  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class BrandPageResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: BrandResponseDto, isArray: true })
  data!: BrandResponseDto[];
}

export class CategoryPageResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: CategoryResponseDto, isArray: true })
  data!: CategoryResponseDto[];
}

export class AttributePageResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: AttributeResponseDto, isArray: true })
  data!: AttributeResponseDto[];
}

export class ProductPageResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: ProductResponseDto, isArray: true })
  data!: ProductResponseDto[];
}
