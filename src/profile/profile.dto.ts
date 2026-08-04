import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2_000)
  avatarUrl?: string;
}

export class NotificationPreferencesDto {
  @IsBoolean()
  newOrder!: boolean;

  @IsBoolean()
  toConfirm!: boolean;

  @IsBoolean()
  lowStock!: boolean;

  @IsBoolean()
  reviews!: boolean;

  @IsBoolean()
  emailDigest!: boolean;
}
