import type { PricedListing } from '../orders/pricing.js';
import { evaluatePolicy, type PolicyLimits } from './policy.engine.js';

const limits: PolicyLimits = { hardCapCents: 10000, confirmAboveCents: 5000, feePercent: 10 };

const listing = (id: string, businessId: string, priceCents: number, over: Partial<PricedListing> = {}): PricedListing => ({
  id,
  title: `Item ${id}`,
  priceCents,
  currency: 'USD',
  active: true,
  business: { id: businessId, name: `Biz ${businessId}`, paypalMerchantId: `M_${businessId}`, onboarding: 'READY' },
  ...over,
});

const listings = [
  listing('print', 'b1', 1000),
  listing('cut', 'b2', 1500),
  listing('big', 'b1', 6000),
  listing('huge', 'b1', 11000),
  listing('ride', 'b3', 800, {
    business: { id: 'b3', name: 'Biz b3', paypalMerchantId: null, onboarding: 'NOT_STARTED' },
  }),
  listing('gone', 'b1', 500, { active: false }),
];

const codes = (v: ReturnType<typeof evaluatePolicy>) => v.reasons.map((r) => r.code);

describe('policy engine', () => {
  it('ALLOWs a normal order inside the budget', () => {
    const v = evaluatePolicy(
      [{ listingId: 'print', quantity: 1 }, { listingId: 'cut', quantity: 1 }],
      listings,
      { budgetCents: 2500 },
      limits,
    );
    expect(v.decision).toBe('ALLOW');
    expect(v.reasons).toHaveLength(0);
    expect(v.cart?.totalCents).toBe(2500);
  });

  it('ASKs when the total is over the stated budget', () => {
    const v = evaluatePolicy([{ listingId: 'cut', quantity: 2 }], listings, { budgetCents: 2500 }, limits);
    expect(v.decision).toBe('ASK');
    expect(codes(v)).toContain('OVER_BUDGET');
  });

  it('ASKs for a large order above the confirm threshold', () => {
    const v = evaluatePolicy([{ listingId: 'big', quantity: 1 }], listings, {}, limits);
    expect(v.decision).toBe('ASK');
    expect(codes(v)).toContain('LARGE_ORDER');
  });

  it('ASKs when the price changed since it was quoted', () => {
    const v = evaluatePolicy([{ listingId: 'print', quantity: 1 }], listings, { quotedTotalCents: 800 }, limits);
    expect(v.decision).toBe('ASK');
    expect(codes(v)).toContain('PRICE_CHANGED');
  });

  it('BLOCKs a seller that is not connected to PayPal', () => {
    const v = evaluatePolicy([{ listingId: 'ride', quantity: 1 }], listings, {}, limits);
    expect(v.decision).toBe('BLOCK');
    expect(codes(v)).toContain('SELLER_NOT_CONNECTED');
    expect(v.cart).toBeUndefined();
  });

  it('BLOCKs above the hard cap', () => {
    const v = evaluatePolicy([{ listingId: 'huge', quantity: 1 }], listings, {}, limits);
    expect(v.decision).toBe('BLOCK');
    expect(codes(v)).toContain('OVER_HARD_CAP');
  });

  it('BLOCKs unknown and inactive listings', () => {
    expect(codes(evaluatePolicy([{ listingId: 'nope', quantity: 1 }], listings, {}, limits))).toContain('UNKNOWN_LISTING');
    expect(codes(evaluatePolicy([{ listingId: 'gone', quantity: 1 }], listings, {}, limits))).toContain('LISTING_INACTIVE');
  });

  it('BLOCKs empty carts and bad quantities', () => {
    expect(evaluatePolicy([], listings, {}, limits).decision).toBe('BLOCK');
    expect(evaluatePolicy('x', listings, {}, limits).decision).toBe('BLOCK');
    expect(codes(evaluatePolicy([{ listingId: 'print', quantity: 0 }], listings, {}, limits))).toContain('BAD_QUANTITY');
  });

  it('BLOCK wins over ASK when a cart has both problems', () => {
    const v = evaluatePolicy(
      [{ listingId: 'ride', quantity: 1 }, { listingId: 'big', quantity: 1 }],
      listings,
      { budgetCents: 100 },
      limits,
    );
    expect(v.decision).toBe('BLOCK');
  });
});
