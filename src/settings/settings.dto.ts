import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const trimValue = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateIdentitySettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Transform(trimValue)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(emptyToUndefined)
  @Transform(trimValue)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(emptyToUndefined)
  @Transform(trimValue)
  logoUrl?: string;
}

export class UpdateSupportSettingsDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  @Transform(emptyToUndefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(emptyToUndefined)
  @Transform(trimValue)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Transform(emptyToUndefined)
  @Transform(trimValue)
  whatsapp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(emptyToUndefined)
  @Transform(trimValue)
  address?: string;
}

export class UpdateSeoSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  @Transform(trimValue)
  defaultTitle?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  @Transform(trimValue)
  defaultDescription?: string;
}

export class UpdateStoreSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateIdentitySettingsDto)
  identity?: UpdateIdentitySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSupportSettingsDto)
  support?: UpdateSupportSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateSeoSettingsDto)
  seo?: UpdateSeoSettingsDto;
}
