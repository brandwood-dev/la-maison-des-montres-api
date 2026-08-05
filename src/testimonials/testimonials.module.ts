import { Module } from '@nestjs/common';
import {
  PublicTestimonialsController,
  TestimonialsController,
} from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';

@Module({
  controllers: [TestimonialsController, PublicTestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
