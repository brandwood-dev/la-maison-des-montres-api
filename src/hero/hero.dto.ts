import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListHeroSlidesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 10;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  active?: boolean;
}

export class CreateHeroSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tagline?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  ctaPrimaryLabel!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  ctaPrimaryHref!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  ctaSecondaryLabel!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  ctaSecondaryHref!: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageAlt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateHeroSlideDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  ctaPrimaryLabel?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  ctaPrimaryHref?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  ctaSecondaryLabel?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  ctaSecondaryHref?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageAlt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ReorderHeroSlidesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  ids!: string[];
}
