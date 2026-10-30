import { BadRequestException } from '@nestjs/common';
import { centsToDecimal, decimalToCents } from '../common/money.js';
import { priceCart, type PricedListing } from './pricing.js';

const business = (id: string, ready = true) => ({
  id,
  name: `Biz ${id}`,
  paypalMerchantId: ready ? `MERCHANT_${id}` : null,
  onboarding: ready ? 'READY' : 'NOT_STARTED',
});

const listing = (id: string, businessId: string, priceCents: number, ready = true): PricedListing => ({
  id,
  title: `Item ${id}`,
  priceCents,
  currency: 'USD',
  active: true,
  business: business(businessId, ready),
});

describe('money helpers', () => {
  it('formats cents as PayPal decimals', () => {
    expect(centsToDecimal(1000)).toBe('10.00');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(1250)).toBe('12.50');
  });
  it('parses decimals to cents', () => {
    expect(decimalToCents('0.84')).toBe(84);
    expect(decimalToCents('12.49')).toBe(1249);
    expect(decimalToCents(undefined)).toBeNull();
  });
});

describe('priceCart', () => {
  const listings = [listing('a', 'b1', 1000), listing('b', 'b2', 1500), listing('c', 'b1', 500), listing('r', 'b3', 800, false)];

  it('takes a 10% fee per seller and groups lines by seller', () => {
    const cart = priceCart(
      [
        { listingId: 'a', quantity: 1 },
        { listingId: 'b', quantity: 1 },
        { listingId: 'c', quantity: 2 },
      ],
      listings,
      10,
    );
    expect(cart.sellers).toHaveLength(2);
    const b1 = cart.sellers.find((s) => s.businessId === 'b1')!;
    expect(b1.amountCents).toBe(2000); // 1000 + 2*500
    expect(b1.platformFeeCents).toBe(200);
    const b2 = cart.sellers.find((s) => s.businessId === 'b2')!;
    expect(b2.amountCents).toBe(1500);
    expect(b2.platformFeeCents).toBe(150);
    expect(cart.totalCents).toBe(3500);
    expect(cart.platformFeeCents).toBe(350);
  });

  it('merges duplicate listing ids', () => {
    const cart = priceCart(
      [
        { listingId: 'a', quantity: 1 },
        { listingId: 'a', quantity: 2 },
      ],
      listings,
      10,
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].quantity).toBe(3);
  });

  it('refuses a business that is not connected to PayPal', () => {
    expect(() => priceCart([{ listingId: 'r', quantity: 1 }], listings, 10)).toThrow(BadRequestException);
  });

  it('refuses unknown listings, empty carts and bad quantities', () => {
    expect(() => priceCart([{ listingId: 'zzz', quantity: 1 }], listings, 10)).toThrow(BadRequestException);
    expect(() => priceCart([], listings, 10)).toThrow(BadRequestException);
    expect(() => priceCart([{ listingId: 'a', quantity: 0 }], listings, 10)).toThrow(BadRequestException);
    expect(() => priceCart([{ listingId: 'a', quantity: 1.5 }], listings, 10)).toThrow(BadRequestException);
  });
});
