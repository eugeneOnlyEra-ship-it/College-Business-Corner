import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../paypal/paypal.service.js', () => ({ PaypalService: class {} }));
import { BusinessesService } from './businesses.service.js';

const owned = { id: 'b1', owner: { email: 'amina@campus.test' } };
const listing = { id: 'l1', businessId: 'b1' };

function make() {
  const prisma = {
    business: { findUnique: vi.fn().mockResolvedValue(owned), update: vi.fn(async ({ data }) => ({ id: 'b1', name: 'N', category: 'c', description: 'd', ...data })) },
    listing: { findFirst: vi.fn().mockResolvedValue(listing), update: vi.fn(async ({ data }) => ({ id: 'l1', title: 'T', description: '', kind: 'SERVICE', priceCents: 1000, unit: null, active: true, ...data })) },
  };
  return { prisma, svc: new BusinessesService(prisma as never, {} as never) };
}
const me = 'amina@campus.test';

describe('BusinessesService.updateListing', () => {
  it('changes only what was sent', async () => {
    const { svc, prisma } = make();
    const r = await svc.updateListing('b1', 'l1', { ownerEmail: me, priceCents: 1800 });
    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { priceCents: 1800 } });
    expect(r.priceCents).toBe(1800);
  });
  it('can hide and show a listing', async () => {
    const { svc, prisma } = make();
    await svc.updateListing('b1', 'l1', { ownerEmail: me, active: false });
    expect(prisma.listing.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { active: false } });
  });
  it('rejects a bad price, empty change, or non-boolean active', async () => {
    const { svc } = make();
    await expect(svc.updateListing('b1', 'l1', { ownerEmail: me, priceCents: 10 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateListing('b1', 'l1', { ownerEmail: me, priceCents: 1.5 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateListing('b1', 'l1', { ownerEmail: me })).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateListing('b1', 'l1', { ownerEmail: me, active: 'no' as never })).rejects.toBeInstanceOf(BadRequestException);
  });
  it("refuses another owner's business and unknown listings", async () => {
    const { svc, prisma } = make();
    await expect(svc.updateListing('b1', 'l1', { ownerEmail: 'someone@else.test', title: 'Hacked' })).rejects.toBeInstanceOf(ForbiddenException);
    prisma.listing.findFirst.mockResolvedValue(null);
    await expect(svc.updateListing('b1', 'zzz', { ownerEmail: me, title: 'Ok title' })).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('BusinessesService.updateBusiness', () => {
  it('updates details and lowercases the category', async () => {
    const { svc, prisma } = make();
    await svc.updateBusiness('b1', { ownerEmail: me, description: 'Open daily.', category: 'Salon' });
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { description: 'Open daily.', category: 'salon' } });
  });
  it("refuses someone else's business", async () => {
    const { svc } = make();
    await expect(svc.updateBusiness('b1', { ownerEmail: 'x@y.test', name: 'Mine now' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
