import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
import { ListingsService } from './listings.service.js';

describe('shoppers never see a closed business', () => {
  it('search only returns listings of open businesses', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const svc = new ListingsService({ listing: { findMany } } as never, { record: vi.fn() } as never);
    await svc.search({ q: 'laundry' });
    expect(findMany.mock.calls[0][0].where.business).toEqual({ closedAt: null });
    expect(findMany.mock.calls[0][0].where.active).toBe(true);
  });
  it('a closed business page is "not found"', async () => {
    const business = { id: 'b1', name: 'Gone', category: 'c', description: '', createdAt: new Date(), onboarding: 'READY', paypalMerchantId: 'M', closedAt: new Date(), listings: [] };
    const svc = new ListingsService({ business: { findUnique: vi.fn().mockResolvedValue(business) } } as never, { record: vi.fn() } as never);
    await expect(svc.businessProfile('b1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
