import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../paypal/paypal.service.js', () => ({ PaypalService: class {} }));
const removeListingImage = vi.fn().mockResolvedValue(undefined);
vi.mock('./listing-images.js', async (orig) => ({ ...(await orig<typeof import('./listing-images.js')>()), removeListingImage: (...a: unknown[]) => removeListingImage(...a) }));
import { BusinessesService } from './businesses.service.js';

const me = 'amina@campus.test';
const open = { id: 'b1', closedAt: null, onboarding: 'READY', paypalTrackingId: 't', owner: { email: me } };
const closed = { ...open, closedAt: new Date('2026-11-01') };

function make(business: unknown = open, extra: Record<string, unknown> = {}) {
  const prisma: any = {
    business: { findUnique: vi.fn().mockResolvedValue(business), update: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    order: { count: vi.fn().mockResolvedValue(0) },
    orderItem: { count: vi.fn().mockResolvedValue(0), groupBy: vi.fn().mockResolvedValue([]) },
    listing: { findMany: vi.fn().mockResolvedValue([{ id: 'l1' }, { id: 'l2' }]), deleteMany: vi.fn().mockResolvedValue({}), findFirst: vi.fn() },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1' }), upsert: vi.fn().mockResolvedValue({ id: 'u1' }) },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    ...extra,
  };
  return { prisma, svc: new BusinessesService(prisma, { createOnboardingLink: vi.fn() } as never) };
}

describe('close', () => {
  it('closes the owner\'s business, keeping everything else', async () => {
    const { svc, prisma } = make();
    expect(await svc.close('b1', me)).toEqual({ id: 'b1', closed: true });
    expect(prisma.business.update).toHaveBeenCalledTimes(1);
    expect(prisma.business.update.mock.calls[0][0].data.closedAt).toBeInstanceOf(Date);
    expect(prisma.business.delete).not.toHaveBeenCalled();
  });
  it('is harmless to repeat', async () => {
    const { svc, prisma } = make(closed);
    expect(await svc.close('b1', me)).toEqual({ id: 'b1', closed: true });
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
  it('is refused while a buyer may still be paying, and looks only at recent unfinished orders for this business', async () => {
    const { svc, prisma } = make(open, { order: { count: vi.fn().mockResolvedValue(1) } });
    await expect(svc.close('b1', me)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.business.update).not.toHaveBeenCalled();
    const where = prisma.order.count.mock.calls[0][0].where;
    expect(where.status.in).toEqual(['CREATED', 'AWAITING_APPROVAL']);
    expect(where.items).toEqual({ some: { businessId: 'b1' } });
    expect(where.createdAt.gt).toBeInstanceOf(Date);
  });
  it('is for the owner only', async () => {
    const { svc, prisma } = make();
    await expect(svc.close('b1', 'someone@else.test')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.business.update).not.toHaveBeenCalled();
  });
});

describe('reopen', () => {
  it('opens a closed business and leaves an open one alone', async () => {
    const a = make(closed);
    expect(await a.svc.reopen('b1', me)).toEqual({ id: 'b1', closed: false });
    expect(a.prisma.business.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { closedAt: null } });
    const b = make(open);
    await b.svc.reopen('b1', me);
    expect(b.prisma.business.update).not.toHaveBeenCalled();
  });
  it('is for the owner only', async () => {
    await expect(make(closed).svc.reopen('b1', 'x@y.test')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('remove (delete permanently)', () => {
  it('deletes the listings and the business, and their photos, when nothing was ever ordered', async () => {
    removeListingImage.mockClear();
    const { svc, prisma } = make();
    expect(await svc.remove('b1', me)).toEqual({ id: 'b1', deleted: true });
    expect(prisma.listing.deleteMany).toHaveBeenCalledWith({ where: { businessId: 'b1' } });
    expect(prisma.business.delete).toHaveBeenCalledWith({ where: { id: 'b1' } });
    expect(removeListingImage.mock.calls.map((c) => c[0])).toEqual(['l1', 'l2']);
  });
  it('refuses when there is order history, and deletes nothing', async () => {
    removeListingImage.mockClear();
    const { svc, prisma } = make(open, { orderItem: { count: vi.fn().mockResolvedValue(3), groupBy: vi.fn() } });
    await expect(svc.remove('b1', me)).rejects.toThrow(/order history/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.business.delete).not.toHaveBeenCalled();
    expect(removeListingImage).not.toHaveBeenCalled();
  });
  it('turns a database refusal (an order arrived at the last moment) into a clear message and keeps the photos', async () => {
    removeListingImage.mockClear();
    const { svc } = make(open, { $transaction: vi.fn().mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003' })) });
    await expect(svc.remove('b1', me)).rejects.toBeInstanceOf(ConflictException);
    expect(removeListingImage).not.toHaveBeenCalled();
  });
  it('is for the owner only', async () => {
    const { svc, prisma } = make();
    await expect(svc.remove('b1', 'someone@else.test')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.business.delete).not.toHaveBeenCalled();
  });
});

describe('a closed business is read-only', () => {
  it.each([
    ['add a listing', (s: BusinessesService) => s.addListing('b1', { ownerEmail: me, title: 'New thing', priceCents: 500, kind: 'SERVICE' } as never)],
    ['change a listing', (s: BusinessesService) => s.updateListing('b1', 'l1', { ownerEmail: me, active: true } as never)],
    ['edit the details', (s: BusinessesService) => s.updateBusiness('b1', { ownerEmail: me, name: 'Another name' } as never)],
    ['upload a photo', (s: BusinessesService) => s.setListingImage('b1', 'l1', { ownerEmail: me, data: 'x' } as never)],
    ['connect PayPal', (s: BusinessesService) => s.connectPaypal('b1', me)],
  ])('cannot %s', async (_name, act) => {
    await expect(act(make(closed).svc)).rejects.toThrow(/closed/);
  });
});

describe('listing a owner\'s businesses', () => {
  it('reports which are closed and which have order history', async () => {
    const { svc } = make(open, {
      business: { findMany: vi.fn().mockResolvedValue([{ ...open, name: 'A', category: 'x', description: '', listings: [] }, { ...closed, id: 'b2', name: 'B', category: 'y', description: '', listings: [] }]), count: vi.fn() },
      orderItem: { groupBy: vi.fn().mockResolvedValue([{ businessId: 'b2' }]), count: vi.fn() },
    });
    const r = await svc.listForOwner(me);
    expect(r.map((b) => [b.id, b.closed, b.hasOrders])).toEqual([['b1', false, false], ['b2', true, true]]);
  });
  it('closed businesses do not use up the five-business allowance', async () => {
    const { svc, prisma } = make();
    await svc.create({ ownerEmail: me, name: 'Fresh one', category: 'salon' } as never).catch(() => undefined);
    expect(prisma.business.count.mock.calls[0][0].where.closedAt).toBeNull();
  });
});
