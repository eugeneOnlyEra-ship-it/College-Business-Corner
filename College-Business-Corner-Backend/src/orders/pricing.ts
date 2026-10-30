import { BadRequestException } from '@nestjs/common';

/**
 * Pure pricing logic (no database, no PayPal) so it can be unit tested offline.
 * The SERVER decides prices: the client only says which listing and how many.
 */

export interface CartLineInput {
  listingId: string;
  quantity: number;
}

export interface PricedListing {
  id: string;
  title: string;
  priceCents: number;
  currency: string;
  active: boolean;
  business: {
    id: string;
    name: string;
    paypalMerchantId: string | null;
    onboarding: string;
  };
}

export interface PricedLine {
  listingId: string;
  title: string;
  businessId: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  platformFeeCents: number;
}

export interface SellerTotal {
  businessId: string;
  businessName: string;
  merchantId: string;
  amountCents: number;
  platformFeeCents: number;
  description: string;
}

export interface PricedCart {
  lines: PricedLine[];
  sellers: SellerTotal[];
  totalCents: number;
  platformFeeCents: number;
}

export const MAX_LINES = 20;
export const MAX_QUANTITY = 20;

export function priceCart(
  input: CartLineInput[],
  listings: PricedListing[],
  feePercent: number,
): PricedCart {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BadRequestException('Order needs at least one item');
  }
  if (input.length > MAX_LINES) {
    throw new BadRequestException(`An order can have at most ${MAX_LINES} items`);
  }

  // Merge duplicate listing ids into one line.
  const quantities = new Map<string, number>();
  for (const line of input) {
    if (!line?.listingId || typeof line.listingId !== 'string') {
      throw new BadRequestException('Every item needs a listingId');
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      throw new BadRequestException(`quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
    }
    quantities.set(line.listingId, (quantities.get(line.listingId) ?? 0) + line.quantity);
  }

  const byId = new Map(listings.map((l) => [l.id, l]));
  const lines: PricedLine[] = [];

  for (const [listingId, quantity] of quantities) {
    const listing = byId.get(listingId);
    if (!listing) throw new BadRequestException(`Listing ${listingId} does not exist`);
    if (!listing.active) throw new BadRequestException(`"${listing.title}" is no longer available`);
    if (listing.currency !== 'USD') {
      throw new BadRequestException(`"${listing.title}" is not priced in USD`);
    }
    if (
      listing.business.onboarding !== 'READY' ||
      !listing.business.paypalMerchantId
    ) {
      throw new BadRequestException(
        `${listing.business.name} is not connected to PayPal yet, so "${listing.title}" cannot be paid for`,
      );
    }
    const lineTotalCents = listing.priceCents * quantity;
    lines.push({
      listingId,
      title: listing.title,
      businessId: listing.business.id,
      quantity,
      unitPriceCents: listing.priceCents,
      lineTotalCents,
      // Fee per line; the seller's fee is the sum of its lines, so everything always adds up.
      platformFeeCents: Math.round((lineTotalCents * feePercent) / 100),
    });
  }

  const sellerMap = new Map<string, SellerTotal>();
  for (const line of lines) {
    const business = byId.get(line.listingId)!.business;
    const existing = sellerMap.get(line.businessId);
    const label = line.quantity > 1 ? `${line.title} x${line.quantity}` : line.title;
    if (existing) {
      existing.amountCents += line.lineTotalCents;
      existing.platformFeeCents += line.platformFeeCents;
      existing.description += `, ${label}`;
    } else {
      sellerMap.set(line.businessId, {
        businessId: line.businessId,
        businessName: business.name,
        merchantId: business.paypalMerchantId!,
        amountCents: line.lineTotalCents,
        platformFeeCents: line.platformFeeCents,
        description: label,
      });
    }
  }
  const sellers = [...sellerMap.values()].map((s) => ({
    ...s,
    description: s.description.slice(0, 127), // PayPal's description limit
  }));

  return {
    lines,
    sellers,
    totalCents: sellers.reduce((sum, s) => sum + s.amountCents, 0),
    platformFeeCents: sellers.reduce((sum, s) => sum + s.platformFeeCents, 0),
  };
}
