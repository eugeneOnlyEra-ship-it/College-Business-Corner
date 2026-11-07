import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
import { PolicyService } from './policy.service.js';

function make(user: unknown = { id: 'u1', maxOrderCents: null, confirmAboveCents: null }) {
  const prisma = { user: { findUnique: vi.fn().mockResolvedValue(user), update: vi.fn().mockResolvedValue({}) } };
  return { prisma, svc: new PolicyService(prisma as never, { get: () => undefined } as never) };
}

describe('PolicyService personal limits', () => {
  it("limitsFor applies the buyer's own limits", async () => {
    const { svc } = make({ maxOrderCents: 3000, confirmAboveCents: 1000 });
    expect(await svc.limitsFor('a@b.test')).toMatchObject({ hardCapCents: 3000, confirmAboveCents: 1000 });
    expect(await svc.limitsFor(undefined)).toMatchObject({ hardCapCents: 10000, confirmAboveCents: 5000 });
  });
  it('saves valid limits, null clears', async () => {
    const { svc, prisma } = make();
    await svc.setLimits('a@b.test', { maxOrderCents: 4000, confirmAboveCents: null });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { maxOrderCents: 4000, confirmAboveCents: null } });
  });
  it('rejects above the system cap, too small, non-integers, and ask-above-max', async () => {
    const { svc } = make();
    for (const bad of [{ maxOrderCents: 10001 }, { maxOrderCents: 10 }, { maxOrderCents: 12.5 }, { confirmAboveCents: '9' }, { maxOrderCents: 2000, confirmAboveCents: 3000 }]) {
      await expect(svc.setLimits('a@b.test', bad as never)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
