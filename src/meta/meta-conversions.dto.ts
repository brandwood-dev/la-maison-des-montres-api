import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const META_RELAYABLE_EVENTS = [
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
] as const;

export type MetaRelayableEvent = (typeof META_RELAYABLE_EVENTS)[number];

export class MetaContentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  id!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  itemPrice?: number;
}

/**
 * Browser events are relayed to the backend so the Meta access token never
 * reaches the storefront. The DTO deliberately exposes only the commerce
 * fields used by the site instead of accepting arbitrary custom data.
 */
export class MetaEventDto {
  @IsIn(META_RELAYABLE_EVENTS)
  eventName!: MetaRelayableEvent;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  eventId!: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2_000)
  eventSourceUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  contentName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentType?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  contentIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MetaContentDto)
  contents?: MetaContentDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value?: number;

  @IsOptional()
  @IsIn(['TND'])
  currency?: 'TND';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  numItems?: number;

  /** Meta browser identifiers, read from the first-party cookies. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fbp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fbc?: string;
}
