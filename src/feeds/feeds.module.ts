import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MetaFeedController } from './meta-feed.controller';
import { MetaFeedService } from './meta-feed.service';

@Module({
  imports: [CatalogModule],
  controllers: [MetaFeedController],
  providers: [MetaFeedService],
})
export class FeedsModule {}
