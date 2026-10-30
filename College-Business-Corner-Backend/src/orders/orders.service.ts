import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { centsToDecimal, decimalToCents } from '../common/money.js';
import { PaypalService } from '../paypal/paypal.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateStoreOrderDto } from './orders.dto.js';
import { priceCart } from './pricing.js';

const DEFAULT_BUYER_EMAIL = 'student@example.com';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly feePercent: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
    config: ConfigService,
  ) {
    const raw = Number(config.get('PLATFORM_FEE_PERCENT') ?? 10);
    this.feePercent = Number.isFinite(raw) && raw >= 0 && raw <= 50 ? raw : 10;
  }

  /** Prices the cart from the database, saves the order, then creates the PayPal order. */
  async createOrder(dto: CreateStoreOrderDto) {
    const buyer = await this.prisma.user.findUnique({
      where: { email: dto.buyerEmail ?? DEFAULT_BUYER_EMAIL },
    });
    if (!buyer) {
      throw new NotFoundException('Buyer not found. Run `npm run db:seed` to create the demo student.');
    }

    const ids = [...new Set((dto.items ?? []).map((i) => i?.listingId).filter(Boolean))];
    const listings = await this.prisma.listing.findMany({
      where: { id: { in: ids } },
      include: { business: true },
    });
    const cart = priceCart(dto.items, listings, this.feePercent);

    const order = await this.prisma.order.create({
      data: {
        buyerId: buyer.id,
        status: 'CREATED',
        totalCents: cart.totalCents,
        items: {
          create: cart.lines.map((l) => ({
            listingId: l.listingId,
            businessId: l.businessId,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
            platformFeeCents: l.platformFeeCents,
          })),
        },
        payouts: {
          create: cart.sellers.map((s) => ({
            businessId: s.businessId,
            paypalMerchantId: s.merchantId,
            grossCents: s.amountCents,
            platformFeeCents: s.platformFeeCents,
          })),
        },
      },
    });

    try {
      const pp = await this.paypal.createOrder(
        cart.sellers.map((s) => ({
          sellerMerchantId: s.merchantId,
          amount: centsToDecimal(s.amountCents),
          platformFee: centsToDecimal(s.platformFeeCents),
          description: s.description,
        })),
        { returnPath: '/orders/return', cancelPath: '/orders/cancel' },
      );
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paypalOrderId: pp.orderId, status: 'AWAITING_APPROVAL' },
      });
      return {
        orderId: order.id,
        paypalOrderId: pp.orderId,
        status: 'AWAITING_APPROVAL',
        approveUrl: pp.approveUrl,
        totalCents: cart.totalCents,
        platformFeeCents: cart.platformFeeCents,
        sellers: cart.sellers.map((s) => ({
          business: s.businessName,
          amountCents: s.amountCents,
          platformFeeCents: s.platformFeeCents,
        })),
      };
    } catch (err) {
      await this.prisma.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
      throw err;
    }
  }

  /** Called when PayPal redirects the buyer back. Captures once; safe to call again. */
  async capture(paypalOrderId: string) {
    if (!paypalOrderId) throw new BadRequestException('token is required');
    const order = await this.prisma.order.findUnique({
      where: { paypalOrderId },
      include: { payouts: true },
    });
    if (!order) throw new NotFoundException('No order matches this PayPal token');
    if (order.status === 'COMPLETED') return this.getOrder(order.id);
    if (order.status !== 'AWAITING_APPROVAL') {
      throw new BadRequestException(`Order is ${order.status} and cannot be captured`);
    }

    // If PayPal rejects the capture (e.g. declined card) we leave the order awaiting approval
    // so the buyer can try again, and let the error through.
    const result = await this.paypal.captureOrder(paypalOrderId);

    const bySeller = new Map(result.captures.map((c: any) => [c.seller as string, c]));
    const allCaptured =
      result.status === 'COMPLETED' &&
      order.payouts.every((p) => (bySeller.get(p.paypalMerchantId) as any)?.status === 'COMPLETED');

    await this.prisma.$transaction([
      ...order.payouts.map((p) => {
        const c = bySeller.get(p.paypalMerchantId) as any;
        return this.prisma.orderPayout.update({
          where: { id: p.id },
          data: {
            paypalCaptureId: c?.captureId ?? null,
            captureStatus: c?.status ?? null,
            paypalFeeCents: decimalToCents(c?.paypalFee),
            netCents: decimalToCents(c?.net),
          },
        });
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: allCaptured ? 'COMPLETED' : 'FAILED' },
      }),
    ]);
    this.logger.log(`Order ${order.id} ${allCaptured ? 'COMPLETED' : 'FAILED'}`);
    return this.getOrder(order.id);
  }

  async cancel(paypalOrderId?: string) {
    if (paypalOrderId) {
      await this.prisma.order.updateMany({
        where: { paypalOrderId, status: 'AWAITING_APPROVAL' },
        data: { status: 'CANCELLED' },
      });
    }
    return { message: 'Payment cancelled by buyer' };
  }

  async getOrder(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        buyer: { select: { name: true, email: true } },
        items: { include: { listing: { select: { title: true } }, business: { select: { name: true } } } },
        payouts: { include: { business: { select: { name: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
