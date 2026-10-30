import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CreateStoreOrderDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Body: listing ids + quantities only. Prices and fees are decided by the server.
  @Post()
  create(@Body() body: CreateStoreOrderDto) {
    return this.orders.createOrder(body);
  }

  // PayPal sends the buyer here after approval. DEV SHORTCUT: capture on GET.
  // Later the frontend will call a POST after the buyer approves.
  @Get('return')
  @ApiQuery({ name: 'token', required: true })
  approvedReturn(@Query('token') token: string) {
    return this.orders.capture(token);
  }

  @Get('cancel')
  @ApiQuery({ name: 'token', required: false })
  cancelled(@Query('token') token?: string) {
    return this.orders.cancel(token);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.orders.getOrder(id);
  }
}
