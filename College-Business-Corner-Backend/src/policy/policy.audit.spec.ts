import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
import { PolicyService } from './policy.service.js';

describe('PolicyService.recentAudit', () => {
  it("only ever queries the signed-in buyer's own entries", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const svc = new PolicyService({ auditLog: { findMany } } as never, { get: () => undefined } as never);
    await svc.recentAudit('a@b.test');
    await svc.recentAudit('a@b.test', 'order-1');
    expect(findMany.mock.calls[0][0].where).toEqual({ buyerEmail: 'a@b.test' });
    expect(findMany.mock.calls[1][0].where).toEqual({ buyerEmail: 'a@b.test', orderId: 'order-1' });
    expect(findMany.mock.calls[0][0].omit).toEqual({ buyerEmail: true });
  });
});
