import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../paypal/paypal.service.js', () => ({ PaypalService: class {} }));
vi.mock('../policy/policy.service.js', () => ({ PolicyService: class {} }));
import { OrdersService } from './orders.service.js';

describe('OrdersService.listForBuyer', () => {
  it("returns only the buyer's orders, summarised", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'o1', status: 'COMPLETED', totalCents: 3000, createdAt: new Date('2026-11-03T10:00:00Z'), items: [{ quantity: 2, listing: { title: 'Haircut' }, business: { name: 'Fresh Cuts' } }] },
    ]);
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1' }) }, order: { findMany } };
    const r = await new OrdersService(prisma as never, {} as never, {} as never).listForBuyer('a@b.test');
    expect(findMany.mock.calls[0][0].where).toEqual({ buyerId: 'u1' });
    expect(r).toEqual([{ id: 'o1', status: 'COMPLETED', totalCents: 3000, createdAt: '2026-11-03T10:00:00.000Z', items: [{ title: 'Haircut', quantity: 2, business: 'Fresh Cuts' }] }]);
  });
  it('returns an empty list for an unknown buyer', async () => {
    const prisma = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    expect(await new OrdersService(prisma as never, {} as never, {} as never).listForBuyer('x@y.test')).toEqual([]);
  });
});
