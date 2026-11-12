import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { websiteUrl } from '../frontend-url.js';
import { CreateOrderDto, OnboardSellerDto } from './dto/paypal.dto.js';
import { PaypalService } from './paypal.service.js';

/**
 * DEV endpoints. These exist to prove the PayPal flow works end to end.
 * They will be replaced by authenticated endpoints in the orders/businesses modules.
 */
@ApiTags('paypal')
@Controller('paypal')
export class PaypalController {
  constructor(
    private readonly paypal: PaypalService,
    private readonly config: ConfigService,
  ) {}

  @Post('onboard')
  onboard(@Body() body: OnboardSellerDto) {
    return this.paypal.createOnboardingLink(body.trackingId);
  }

  // PayPal redirects the seller here after onboarding. Send them back to their business page, which checks the
  // PayPal status by itself. Without a website to go back to (Swagger testing) the query params are echoed
  // (merchantIdInPayPal, permissionsGranted, isEmailConfirmed).
  @Get('onboarding-return')
  onboardingReturn(@Query() query: Record<string, string>, @Res() res: Response) {
    const to = websiteUrl('/sell', this.config.get<string>('FRONTEND_URL'));
    if (to) return res.redirect(to);
    return res.json(query);
  }

  // Finds the seller's PayPal merchant ID from YOUR tracking id (use after onboarding).
  @Get('lookup/:trackingId')
  lookup(@Param('trackingId') trackingId: string) {
    return this.paypal.findMerchantIdByTrackingId(trackingId);
  }

  @Get('sellers/:merchantId/status')
  sellerStatus(@Param('merchantId') merchantId: string) {
    return this.paypal.getSellerStatus(merchantId);
  }

  @Post('orders')
  createOrder(@Body() body: CreateOrderDto) {
    return this.paypal.createOrder(body.items);
  }

  // DEV SHORTCUT: after the buyer approves, PayPal redirects here and we capture on GET.
  // In production, capture from an authenticated POST after the frontend's onApprove.
  @Get('return')
  approvedReturn(@Query('token') orderId: string) {
    return this.paypal.captureOrder(orderId);
  }

  @Get('cancel')
  cancelled() {
    return { message: 'Payment cancelled by buyer' };
  }
}
