import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard, OptionalAuthGuard, type AuthedRequest, type MaybeAuthedRequest } from '../auth/auth.guard.js';
import { CreateStoreOrderDto } from './orders.dto.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  // Body: listing ids + quantities only. Prices and fees are decided by the server.
  // A signed-in buyer always buys as themselves (any buyerEmail in the body is ignored). Without sign-in
  // (Swagger testing) the demo student is used.
  @Post()
  @UseGuards(OptionalAuthGuard)
  create(@Body() body: CreateStoreOrderDto, @Req() req: MaybeAuthedRequest) {
    return this.orders.createOrder(req.user ? { ...body, buyerEmail: req.user.email } : body);
  }

  // The signed-in buyer's own orders.
  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  mine(@Req() req: AuthedRequest) {
    return this.orders.listForBuyer(req.user.email);
  }

  // PayPal sends the buyer here after approval and we capture the payment.
  // If FRONTEND_URL is set the buyer is sent on to the app's receipt page; otherwise JSON is returned
  // (handy when testing in Swagger).
  @Get('return')
  @ApiQuery({ name: 'token', required: true })
  async approvedReturn(@Query('token') token: string, @Res() res: Response) {
    const frontend = this.config.get<string>('FRONTEND_URL');
    try {
      const order = await this.orders.capture(token);
      if (frontend) return res.redirect(`${frontend}/#/orders/${order.id}`);
      return res.json(order);
    } catch (err) {
      if (frontend) return res.redirect(`${frontend}/#/problem`);
      throw err;
    }
  }

  @Get('cancel')
  @ApiQuery({ name: 'token', required: false })
  async cancelled(@Query('token') token: string | undefined, @Res() res: Response) {
    const result = await this.orders.cancel(token);
    const frontend = this.config.get<string>('FRONTEND_URL');
    if (frontend) return res.redirect(`${frontend}/#/cancelled`);
    return res.json(result);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.orders.getOrder(id);
  }
}
