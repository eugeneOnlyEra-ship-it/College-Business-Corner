import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
import { PolicyService } from './policy.service.js';

const listing = (closedAt: Date | null) => ({
  id: 'l1', title: 'Haircut', priceCents: 1500, currency: 'USD', active: true, unit: null,
  business: { id: 'b1', name: 'Fresh Cuts', paypalMerchantId: 'M1', onboarding: 'READY', closedAt },
});
function make(found: unknown[]) {
  const prisma = { listing: { findMany: vi.fn().mockResolvedValue(found) }, auditLog: { create: vi.fn().mockResolvedValue({ id: 'a1' }) }, user: { findUnique: vi.fn().mockResolvedValue(null) } };
  return new PolicyService(prisma as never, { get: () => undefined } as never);
}
const ask = (svc: PolicyService) => svc.evaluate({ items: [{ listingId: 'l1', quantity: 1 }], budgetCents: 5000 } as never);

describe('checkout and a closed business', () => {
  it('blocks it as "no longer available"', async () => {
    const r = await ask(make([listing(new Date())]));
    expect(r.decision).toBe('BLOCK');
    expect(r.reasons.map((x) => x.code)).toContain('LISTING_INACTIVE');
  });
  it('still allows the same listing when the business is open', async () => {
    expect((await ask(make([listing(null)]))).decision).toBe('ALLOW');
  });
});
