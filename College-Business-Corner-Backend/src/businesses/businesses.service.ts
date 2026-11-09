import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaypalService } from '../paypal/paypal.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateBusinessDto, CreateListingDto, ListingImageDto, UpdateBusinessDto, UpdateListingDto } from './businesses.dto.js';
import { decodeBase64Image, imageUrlFor, MAX_IMAGE_BYTES, removeListingImage, saveListingImage } from './listing-images.js';

const MAX_BUSINESSES_PER_OWNER = 5;
const MAX_LISTINGS_PER_BUSINESS = 30;
// A PayPal approval link stays valid for about this long, so an unfinished checkout newer than this may still be paid.
const PAYMENT_WINDOW_MS = 3 * 60 * 60 * 1000;

function email(raw: unknown): string {
  const e = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (e.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new BadRequestException('Enter a valid email address.');
  }
  return e;
}

function text(raw: unknown, label: string, min: number, max: number): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s.length < min || s.length > max) {
    throw new BadRequestException(`${label} must be between ${min} and ${max} characters.`);
  }
  return s;
}

function optionalText(raw: unknown, label: string, max: number): string {
  if (raw === undefined || raw === null || raw === '') return '';
  return text(raw, label, 1, max);
}

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypal: PaypalService,
  ) {}

  /**
   * DEMO ACCOUNTS: the owner's email identifies them. There is no password, so anyone who knows the
   * email can manage that business. Real sign-in is the first thing to add for production.
   */
  async create(dto: CreateBusinessDto) {
    const ownerEmail = email(dto?.ownerEmail);
    const name = text(dto.name, 'Business name', 2, 60);
    const category = text(dto.category, 'Category', 2, 30).toLowerCase();
    const description = optionalText(dto.description, 'Description', 200);
    const ownerName = optionalText(dto.ownerName, 'Your name', 60) || ownerEmail.split('@')[0];

    const owner = await this.prisma.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: { email: ownerEmail, name: ownerName },
    });
    const count = await this.prisma.business.count({ where: { ownerId: owner.id, closedAt: null } }); // closed ones do not count
    if (count >= MAX_BUSINESSES_PER_OWNER) {
      throw new BadRequestException(`One account can have at most ${MAX_BUSINESSES_PER_OWNER} businesses.`);
    }
    return this.prisma.business.create({
      data: {
        ownerId: owner.id,
        name,
        category,
        description,
        paypalTrackingId: `biz-${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      },
    });
  }

  async listForOwner(rawEmail: string) {
    const owner = await this.prisma.user.findUnique({ where: { email: email(rawEmail) } });
    if (!owner) return [];
    const businesses = await this.prisma.business.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: 'asc' },
      include: { listings: { orderBy: { createdAt: 'asc' } } },
    });
    // Which of them have ever been ordered from (those can be closed but not deleted).
    const ordered = businesses.length
      ? await this.prisma.orderItem.groupBy({ by: ['businessId'], where: { businessId: { in: businesses.map((b) => b.id) } } })
      : [];
    const withOrders = new Set(ordered.map((o) => o.businessId));
    return businesses.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      description: b.description,
      onboarding: b.onboarding,
      closed: b.closedAt !== null,
      hasOrders: withOrders.has(b.id),
      listings: b.listings.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        priceCents: l.priceCents,
        kind: l.kind,
        unit: l.unit,
        active: l.active,
        imageUrl: imageUrlFor(l.id),
      })),
    }));
  }

  private async getOwned(id: string, rawEmail: unknown) {
    const ownerEmail = email(rawEmail);
    const business = await this.prisma.business.findUnique({ where: { id }, include: { owner: true } });
    if (!business) throw new NotFoundException('Business not found.');
    if (business.owner.email !== ownerEmail) {
      throw new ForbiddenException('This business belongs to a different account.');
    }
    return business;
  }

  /** A closed business is read-only until it is reopened. */
  private assertOpen(business: { closedAt: Date | null }) {
    if (business.closedAt) {
      throw new ConflictException('This business is closed. Reopen it on My business to make changes.');
    }
  }

  async addListing(id: string, dto: CreateListingDto) {
    const business = await this.getOwned(id, dto?.ownerEmail);
    this.assertOpen(business);
    const title = text(dto.title, 'Title', 2, 80);
    const description = optionalText(dto.description, 'Description', 200);
    const unit = optionalText(dto.unit, 'Unit', 30) || null;
    const kind = dto.kind === 'PRODUCT' ? 'PRODUCT' : 'SERVICE';
    if (!Number.isInteger(dto.priceCents) || dto.priceCents < 50 || dto.priceCents > 10000) {
      throw new BadRequestException('Price must be between $0.50 and $100.00.');
    }
    const count = await this.prisma.listing.count({ where: { businessId: business.id } });
    if (count >= MAX_LISTINGS_PER_BUSINESS) {
      throw new BadRequestException(`A business can have at most ${MAX_LISTINGS_PER_BUSINESS} listings.`);
    }
    return this.prisma.listing.create({
      data: { businessId: business.id, title, description, kind, priceCents: dto.priceCents, unit },
    });
  }

  /** Changes only the fields that were sent. Hiding a listing (active: false) keeps it for the owner but removes it from search and checkout. */
  async updateListing(id: string, listingId: string, dto: UpdateListingDto) {
    const business = await this.getOwned(id, dto?.ownerEmail);
    this.assertOpen(business);
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, businessId: business.id } });
    if (!listing) throw new NotFoundException('Listing not found.');
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = text(dto.title, 'Title', 2, 80);
    if (dto.description !== undefined) data.description = optionalText(dto.description, 'Description', 200);
    if (dto.unit !== undefined) data.unit = optionalText(dto.unit, 'Unit', 30) || null;
    if (dto.kind !== undefined) {
      if (dto.kind !== 'PRODUCT' && dto.kind !== 'SERVICE') throw new BadRequestException('Type must be a product or a service.');
      data.kind = dto.kind;
    }
    if (dto.priceCents !== undefined) {
      if (!Number.isInteger(dto.priceCents) || dto.priceCents < 50 || dto.priceCents > 10000) {
        throw new BadRequestException('Price must be between $0.50 and $100.00.');
      }
      data.priceCents = dto.priceCents;
    }
    if (dto.active !== undefined) {
      if (typeof dto.active !== 'boolean') throw new BadRequestException('Active must be true or false.');
      data.active = dto.active;
    }
    if (!Object.keys(data).length) throw new BadRequestException('Nothing to change.');
    const updated = await this.prisma.listing.update({ where: { id: listing.id }, data });
    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      kind: updated.kind,
      priceCents: updated.priceCents,
      unit: updated.unit,
      active: updated.active,
    };
  }

  /** What this business has sold: totals and the most recent paid orders. Only paid (completed) orders count. */
  async sales(id: string, ownerEmail: unknown) {
    const business = await this.getOwned(id, ownerEmail);
    const where = { businessId: business.id, order: { status: 'COMPLETED' as const } };
    const [totals, recent] = await Promise.all([
      this.prisma.orderPayout.aggregate({
        where,
        _count: { _all: true },
        _sum: { grossCents: true, platformFeeCents: true, paypalFeeCents: true, netCents: true },
      }),
      this.prisma.orderPayout.findMany({
        where,
        orderBy: { order: { createdAt: 'desc' } },
        take: 20,
        include: {
          order: {
            select: {
              id: true,
              createdAt: true,
              buyer: { select: { name: true } },
              items: { where: { businessId: business.id }, select: { quantity: true, listing: { select: { title: true } } } },
            },
          },
        },
      }),
    ]);
    return {
      summary: {
        orders: totals._count._all,
        grossCents: totals._sum.grossCents ?? 0,
        platformFeeCents: totals._sum.platformFeeCents ?? 0,
        paypalFeeCents: totals._sum.paypalFeeCents ?? 0,
        netCents: totals._sum.netCents ?? 0,
      },
      recent: recent.map((p) => ({
        orderId: p.order.id,
        date: p.order.createdAt.toISOString(),
        buyerName: p.order.buyer.name,
        grossCents: p.grossCents,
        platformFeeCents: p.platformFeeCents,
        paypalFeeCents: p.paypalFeeCents,
        netCents: p.netCents,
        items: p.order.items.map((i) => ({ title: i.listing.title, quantity: i.quantity })),
      })),
    };
  }

  /** Lets the owner fix the name, category or description of their own business. */
  async updateBusiness(id: string, dto: UpdateBusinessDto) {
    const business = await this.getOwned(id, dto?.ownerEmail);
    this.assertOpen(business);
    const data: Record<string, string> = {};
    if (dto.name !== undefined) data.name = text(dto.name, 'Business name', 2, 60);
    if (dto.category !== undefined) data.category = text(dto.category, 'Category', 2, 30).toLowerCase();
    if (dto.description !== undefined) data.description = optionalText(dto.description, 'Description', 200);
    if (!Object.keys(data).length) throw new BadRequestException('Nothing to change.');
    const updated = await this.prisma.business.update({ where: { id: business.id }, data });
    return { id: updated.id, name: updated.name, category: updated.category, description: updated.description };
  }

  /** Saves (or replaces) the photo of one of the owner's listings. */
  async setListingImage(id: string, listingId: string, dto: ListingImageDto) {
    const business = await this.getOwned(id, dto?.ownerEmail);
    this.assertOpen(business);
    const listing = await this.prisma.listing.findFirst({ where: { id: listingId, businessId: business.id } });
    if (!listing) throw new NotFoundException('Listing not found.');
    const buf = decodeBase64Image(dto?.data);
    if (!buf) throw new BadRequestException('Choose a photo (JPG, PNG or WebP).');
    if (buf.length > MAX_IMAGE_BYTES) throw new BadRequestException('That photo is too big. Try a smaller one (up to 1 MB).');
    try {
      await saveListingImage(listing.id, buf);
    } catch {
      throw new BadRequestException('That file is not a JPG, PNG or WebP photo.');
    }
    return { imageUrl: imageUrlFor(listing.id) };
  }

  /**
   * Closes a business: shoppers can no longer see or order from it, but its order history, receipts and sales stay.
   * Refused while a buyer may still be in the middle of paying it.
   */
  async close(id: string, ownerEmail: unknown) {
    const business = await this.getOwned(id, ownerEmail);
    if (business.closedAt) return { id: business.id, closed: true };
    const unfinished = await this.prisma.order.count({
      where: {
        status: { in: ['CREATED', 'AWAITING_APPROVAL'] },
        createdAt: { gt: new Date(Date.now() - PAYMENT_WINDOW_MS) },
        items: { some: { businessId: business.id } },
      },
    });
    if (unfinished > 0) {
      throw new ConflictException('A buyer is in the middle of paying this business. Please try again in a few minutes.');
    }
    await this.prisma.business.update({ where: { id: business.id }, data: { closedAt: new Date() } });
    return { id: business.id, closed: true };
  }

  /** Opens a closed business again. */
  async reopen(id: string, ownerEmail: unknown) {
    const business = await this.getOwned(id, ownerEmail);
    if (!business.closedAt) return { id: business.id, closed: false };
    await this.prisma.business.update({ where: { id: business.id }, data: { closedAt: null } });
    return { id: business.id, closed: false };
  }

  /**
   * Deletes a business and its listings for good. Only allowed when nothing was ever ordered from it,
   * because orders, receipts and sales point back at it. Otherwise it can be closed instead.
   */
  async remove(id: string, ownerEmail: unknown) {
    const business = await this.getOwned(id, ownerEmail);
    const hasOrders = (await this.prisma.orderItem.count({ where: { businessId: business.id } })) > 0;
    if (hasOrders) {
      throw new ConflictException('This business has order history, so it cannot be deleted. Close it instead.');
    }
    const listings = await this.prisma.listing.findMany({ where: { businessId: business.id }, select: { id: true } });
    try {
      await this.prisma.$transaction([
        this.prisma.listing.deleteMany({ where: { businessId: business.id } }),
        this.prisma.business.delete({ where: { id: business.id } }),
      ]);
    } catch (err) {
      // An order slipped in between the check and the delete: the database refuses, and the business stays.
      if ((err as { code?: string })?.code === 'P2003') {
        throw new ConflictException('This business just received an order, so it cannot be deleted. Close it instead.');
      }
      throw err;
    }
    await Promise.all(listings.map((l) => removeListingImage(l.id).catch(() => undefined)));
    return { id: business.id, deleted: true };
  }

  /** Starts PayPal onboarding and returns the link the owner opens. */
  async connectPaypal(id: string, ownerEmail: unknown) {
    const business = await this.getOwned(id, ownerEmail);
    this.assertOpen(business);
    if (business.onboarding === 'READY') {
      throw new BadRequestException('This business is already connected to PayPal.');
    }
    const link = await this.paypal.createOnboardingLink(business.paypalTrackingId);
    if (!link.onboardingUrl) throw new BadRequestException('PayPal did not return a setup link. Try again.');
    await this.prisma.business.update({ where: { id }, data: { onboarding: 'PENDING' } });
    return { onboardingUrl: link.onboardingUrl };
  }

  /**
   * Asks PayPal where the owner is in the setup, saves the merchant id automatically,
   * and explains in plain words what is still missing.
   */
  async paypalStatus(id: string, ownerEmail: unknown) {
    const business = await this.getOwned(id, ownerEmail);

    let merchantId = business.paypalMerchantId;
    if (!merchantId) {
      try {
        merchantId = (await this.paypal.findMerchantIdByTrackingId(business.paypalTrackingId)).merchantId ?? null;
      } catch {
        merchantId = null; // PayPal does not know this business yet: setup not finished
      }
    }
    if (!merchantId) {
      return {
        onboarding: business.onboarding,
        checks: null,
        fixes:
          business.onboarding === 'PENDING'
            ? ['Finish the steps in the PayPal tab, then check again.']
            : ['Connect your PayPal account to start receiving orders.'],
      };
    }

    let status;
    try {
      status = await this.paypal.getSellerStatus(merchantId);
    } catch {
      return {
        onboarding: business.onboarding,
        checks: null,
        fixes: ['PayPal did not answer just now. Check again in a moment.'],
      };
    }

    const fixes: string[] = [];
    if (!status.permissionsGranted) fixes.push('Approve the permissions PayPal asks for when you connect.');
    if (!status.emailConfirmed) fixes.push('Confirm the email address on your PayPal account.');
    if (!status.paymentsReceivable) fixes.push("Finish setting up your PayPal account so it can receive payments.");

    const onboarding = status.ready ? 'READY' : 'PENDING';
    // Several businesses may share one PayPal account: money for each still goes to that account.
    await this.prisma.business.update({ where: { id }, data: { paypalMerchantId: merchantId, onboarding } });
    return {
      onboarding,
      checks: {
        paymentsReceivable: Boolean(status.paymentsReceivable),
        emailConfirmed: Boolean(status.emailConfirmed),
        permissionsGranted: status.permissionsGranted,
      },
      fixes,
    };
  }
}
