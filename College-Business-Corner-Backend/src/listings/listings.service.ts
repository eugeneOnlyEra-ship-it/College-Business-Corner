import { Injectable } from '@nestjs/common';
import { imageUrlFor } from '../businesses/listing-images.js';
import { InterestsService } from '../insights/interests.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ListingSearch {
  q?: string;
  maxPriceCents?: number;
}

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly interests: InterestsService,
  ) {}

  /** Active listings, optionally filtered by text (title/description/business) and max price. */
  async search({ q, maxPriceCents }: ListingSearch) {
    const text = q?.trim();
    // Count the keywords (never who searched). Covers Browse and the shopping assistant, which both come through here.
    if (text) this.interests.record(text);
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
      imageUrl: imageUrlFor(l.id),
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
