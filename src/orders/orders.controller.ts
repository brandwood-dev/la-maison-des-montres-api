import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { Public } from '../auth/auth.decorators';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService, type PublicOrderResponse } from './orders.service';

@Public()
@Controller('api/v1/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse()
  create(@Body() input: CreateOrderDto): Promise<PublicOrderResponse> {
    return this.orders.create(input);
  }
}
