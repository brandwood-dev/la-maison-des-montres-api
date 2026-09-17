import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/auth.decorators';
import { MetaEventDto } from './meta-conversions.dto';
import { MetaConversionsService } from './meta-conversions.service';

@Controller('api/v1/meta/events')
@Public()
export class MetaConversionsController {
  constructor(private readonly meta: MetaConversionsService) {}

  @Post()
  @HttpCode(204)
  async relay(
    @Body() input: MetaEventDto,
    @Req() request: Request,
  ): Promise<void> {
    await this.meta.relay(input, request);
  }
}
