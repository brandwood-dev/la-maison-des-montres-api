import { Module } from '@nestjs/common';
import { HeroController, PublicHeroController } from './hero.controller';
import { HeroService } from './hero.service';

@Module({
  controllers: [HeroController, PublicHeroController],
  providers: [HeroService],
  exports: [HeroService],
})
export class HeroModule {}
