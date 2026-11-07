import { describe, expect, it } from 'vitest';
import { effectiveLimits } from './limits.js';

const system = { hardCapCents: 10000, confirmAboveCents: 5000, feePercent: 10 };

describe('effectiveLimits', () => {
  it('uses the system limits when the buyer set nothing', () => {
    expect(effectiveLimits(system, null)).toEqual(system);
    expect(effectiveLimits(system, { maxOrderCents: null, confirmAboveCents: null })).toEqual(system);
  });
  it('lets a buyer be stricter', () => {
    expect(effectiveLimits(system, { maxOrderCents: 3000, confirmAboveCents: 1000 })).toMatchObject({ hardCapCents: 3000, confirmAboveCents: 1000 });
  });
  it('never goes above the system cap', () => {
    expect(effectiveLimits(system, { maxOrderCents: 99999 }).hardCapCents).toBe(10000);
  });
  it("never asks above the buyer's own maximum", () => {
    expect(effectiveLimits(system, { maxOrderCents: 2000 })).toMatchObject({ hardCapCents: 2000, confirmAboveCents: 2000 });
  });
});
