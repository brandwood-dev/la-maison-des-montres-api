import { Module } from '@nestjs/common';
import { MetaConversionsController } from './meta-conversions.controller';
import { MetaConversionsService } from './meta-conversions.service';

@Module({
  controllers: [MetaConversionsController],
  providers: [MetaConversionsService],
  exports: [MetaConversionsService],
})
export class MetaModule {}
