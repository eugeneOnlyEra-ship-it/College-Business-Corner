import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
import { ListingsService } from './listings.service.js';

const business = {
  id: 'b1',
  name: 'Fresh Cuts Salon',
  category: 'salon',
  description: 'Haircuts in the hostel common room.',
  createdAt: new Date('2026-10-29T10:00:00Z'),
  onboarding: 'READY',
  paypalMerchantId: 'MERCHANT1',
  ownerId: 'u1',
  paypalTrackingId: 'secret-tracking-id',
  listings: [
    { id: 'l1', title: 'Haircut', description: 'Any style', kind: 'SERVICE', priceCents: 1500, currency: 'USD', unit: 'per haircut' },
  ],
};

const make = (found: unknown) =>
  new ListingsService({ business: { findUnique: vi.fn().mockResolvedValue(found) } } as never, { record: vi.fn() } as never);

describe('ListingsService.businessProfile', () => {
  it('returns the public profile with its active listings', async () => {
    const p = await make(business).businessProfile('b1');
    expect(p).toMatchObject({ id: 'b1', name: 'Fresh Cuts Salon', description: 'Haircuts in the hostel common room.', memberSince: '2026-10-29', canReceivePayments: true });
    expect(p.listings).toHaveLength(1);
    expect(p.listings[0]).toMatchObject({ title: 'Haircut', priceCents: 1500 });
  });

  it('never leaks private fields', async () => {
    const json = JSON.stringify(await make(business).businessProfile('b1'));
    for (const secret of ['secret-tracking-id', 'MERCHANT1', 'u1', 'ownerId', 'paypalMerchantId', 'paypalTrackingId']) {
      expect(json).not.toContain(secret);
    }
  });

  it('says a business that is not connected to PayPal cannot take payments', async () => {
    const p = await make({ ...business, onboarding: 'PENDING', paypalMerchantId: null }).businessProfile('b1');
    expect(p.canReceivePayments).toBe(false);
  });

  it('404s for an unknown business', async () => {
    await expect(make(null).businessProfile('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
