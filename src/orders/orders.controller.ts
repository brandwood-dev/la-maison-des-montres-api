import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { Public, RequirePermissions } from '../auth/auth.decorators';
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  TrackOrderQueryDto,
  UpdateOrderStatusDto,
} from './dto/create-order.dto';
import { OrdersService, type PublicOrderResponse } from './orders.service';

@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  @Public()
  @ApiCreatedResponse()
  create(@Body() input: CreateOrderDto): Promise<PublicOrderResponse> {
    return this.orders.create(input);
  }

  @Get('track')
  @Public()
  track(@Query() query: TrackOrderQueryDto) {
    return this.orders.track(query.reference, query.phone);
  }

  @Get()
  @RequirePermissions('orders.read')
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Get(':id')
  @RequirePermissions('orders.read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.get(id);
  }

  @Patch(':id/status')
  @RequirePermissions('orders.status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, input.status);
  }
}
