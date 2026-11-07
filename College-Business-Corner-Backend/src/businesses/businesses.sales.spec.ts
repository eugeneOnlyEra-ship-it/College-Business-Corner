import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../paypal/paypal.service.js', () => ({ PaypalService: class {} }));
import { BusinessesService } from './businesses.service.js';

function make() {
  const prisma = {
    business: { findUnique: vi.fn().mockResolvedValue({ id: 'b1', owner: { email: 'amina@campus.test' } }) },
    orderPayout: {
      aggregate: vi.fn().mockResolvedValue({ _count: { _all: 2 }, _sum: { grossCents: 4000, platformFeeCents: 400, paypalFeeCents: null, netCents: 3400 } }),
      findMany: vi.fn().mockResolvedValue([
        { grossCents: 3000, platformFeeCents: 300, paypalFeeCents: 117, netCents: 2583, order: { id: 'o1', createdAt: new Date('2026-11-03T10:00:00Z'), buyer: { name: 'Sam' }, items: [{ quantity: 2, listing: { title: 'Haircut' } }] } },
      ]),
    },
  };
  return { prisma, svc: new BusinessesService(prisma as never, {} as never) };
}

describe('BusinessesService.sales', () => {
  it('counts only completed orders and never exposes buyer emails', async () => {
    const { svc, prisma } = make();
    const r = await svc.sales('b1', 'amina@campus.test');
    expect(prisma.orderPayout.aggregate.mock.calls[0][0].where).toEqual({ businessId: 'b1', order: { status: 'COMPLETED' } });
    expect(r.summary).toEqual({ orders: 2, grossCents: 4000, platformFeeCents: 400, paypalFeeCents: 0, netCents: 3400 });
    expect(r.recent[0]).toMatchObject({ orderId: 'o1', buyerName: 'Sam', items: [{ title: 'Haircut', quantity: 2 }] });
    expect(JSON.stringify(r)).not.toContain('@');
  });
  it("refuses someone else's business", async () => {
    await expect(make().svc.sales('b1', 'x@y.test')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
