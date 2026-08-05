import { Module } from '@nestjs/common';
import {
  PromoBannerController,
  PublicPromoBannerController,
} from './promo-banner.controller';
import { PromoBannerService } from './promo-banner.service';

@Module({
  controllers: [PromoBannerController, PublicPromoBannerController],
  providers: [PromoBannerService],
  exports: [PromoBannerService],
})
export class PromoBannerModule {}
