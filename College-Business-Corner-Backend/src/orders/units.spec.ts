import { describe, expect, it } from 'vitest';
import { apportion, mergeByMerchant } from './units.js';

const s = (merchantId: string, amountCents: number, platformFeeCents: number, description: string) => ({
  merchantId, amountCents, platformFeeCents, description,
});

describe('mergeByMerchant', () => {
  it('combines businesses that share a PayPal account into one unit', () => {
    const units = mergeByMerchant([s('M1', 1500, 150, 'Haircut'), s('M2', 300, 30, 'Snack'), s('M1', 500, 50, 'Braids')]);
    expect(units).toHaveLength(2);
    expect(units.find((u) => u.merchantId === 'M1')).toEqual({ merchantId: 'M1', amountCents: 2000, platformFeeCents: 200, description: 'Haircut; Braids' });
  });
  it('leaves separate accounts alone', () => {
    expect(mergeByMerchant([s('A', 100, 10, 'x'), s('B', 200, 20, 'y')])).toHaveLength(2);
  });
});

describe('apportion', () => {
  it('always adds up to the total', () => {
    for (const [total, weights] of [[101, [1500, 500]], [7, [1, 1, 1]], [1, [3, 3]], [0, [5, 5]]] as const) {
      expect(apportion(total, [...weights]).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)).toBe(total);
    }
  });
  it('splits in proportion and handles a single business or unknown total', () => {
    expect(apportion(100, [3000, 1000])).toEqual([75, 25]);
    expect(apportion(55, [1000])).toEqual([55]);
    expect(apportion(null, [1, 2])).toEqual([null, null]);
  });
});
