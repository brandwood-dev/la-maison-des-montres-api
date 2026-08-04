import { Body, Controller, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse } from '@nestjs/swagger';
import { IsInt, IsString, IsIn, Max, Min, MaxLength } from 'class-validator';
import { ACCESS_COOKIE } from '../auth/auth.constants';
import { RequirePermissions } from '../auth/auth.decorators';
import { MediaService, type ProductMediaUploadTicket } from './media.service';

class CreateProductUploadDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
  contentType!: string;

  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  sizeBytes!: number;
}

@Controller('api/v1/media')
@ApiCookieAuth(ACCESS_COOKIE)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('product-upload-url')
  @RequirePermissions('products.write')
  @ApiCreatedResponse()
  createProductUploadUrl(
    @Body() input: CreateProductUploadDto,
  ): Promise<ProductMediaUploadTicket> {
    return this.media.createProductUploadTicket(input);
  }

  @Post('avatar-upload-url')
  @ApiCreatedResponse()
  createAvatarUploadUrl(
    @Body() input: CreateProductUploadDto,
  ): Promise<ProductMediaUploadTicket> {
    return this.media.createAdminAvatarUploadTicket(input);
  }
}
