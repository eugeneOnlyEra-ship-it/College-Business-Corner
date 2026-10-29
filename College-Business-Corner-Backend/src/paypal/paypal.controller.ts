import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateOrderDto, OnboardSellerDto } from './dto/paypal.dto.js';
import { PaypalService } from './paypal.service.js';

/**
 * DEV endpoints. These exist to prove the PayPal flow works end to end.
 * They will be replaced by authenticated endpoints in the orders/businesses modules.
 */
@ApiTags('paypal')
@Controller('paypal')
export class PaypalController {
  constructor(private readonly paypal: PaypalService) {}

  @Post('onboard')
  onboard(@Body() body: OnboardSellerDto) {
    return this.paypal.createOnboardingLink(body.trackingId);
  }

  // PayPal redirects the seller here after onboarding (dev: just echo the query params,
  // which include merchantIdInPayPal, permissionsGranted, isEmailConfirmed).
  @Get('onboarding-return')
  onboardingReturn(@Query() query: Record<string, string>) {
    return query;
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
