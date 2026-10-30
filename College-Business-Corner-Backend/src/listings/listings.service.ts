import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ListingSearch {
  q?: string;
  maxPriceCents?: number;
}

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active listings, optionally filtered by text (title/description/business) and max price. */
  async search({ q, maxPriceCents }: ListingSearch) {
    const text = q?.trim();
    const listings = await this.prisma.listing.findMany({
      where: {
        active: true,
        ...(maxPriceCents !== undefined ? { priceCents: { lte: maxPriceCents } } : {}),
        ...(text
          ? {
              OR: [
                { title: { contains: text } },
                { description: { contains: text } },
                { business: { name: { contains: text } } },
                { business: { category: { contains: text } } },
              ],
            }
          : {}),
      },
      include: { business: true },
      orderBy: { priceCents: 'asc' },
    });

    return listings.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      kind: l.kind,
      priceCents: l.priceCents,
      currency: l.currency,
      unit: l.unit,
      business: {
        id: l.business.id,
        name: l.business.name,
        category: l.business.category,
        // Only READY businesses can receive PayPal payments.
        canReceivePayments: l.business.onboarding === 'READY' && !!l.business.paypalMerchantId,
      },
    }));
  }
}
