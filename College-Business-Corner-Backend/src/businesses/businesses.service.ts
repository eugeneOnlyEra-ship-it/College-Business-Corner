import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaypalService } from '../paypal/paypal.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateBusinessDto, CreateListingDto, ListingImageDto } from './businesses.dto.js';
import { decodeBase64Image, imageUrlFor, MAX_IMAGE_BYTES, saveListingImage } from './listing-images.js';

const MAX_BUSINESSES_PER_OWNER = 5;
const MAX_LISTINGS_PER_BUSINESS = 30;

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
    const count = await this.prisma.business.count({ where: { ownerId: owner.id } });
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
    return businesses.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      description: b.description,
      onboarding: b.onboarding,
      listings: b.listings.map((l) => ({
        id: l.id,
        title: l.title,
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

  async addListing(id: string, dto: CreateListingDto) {
    const business = await this.getOwned(id, dto?.ownerEmail);
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

  /** Saves (or replaces) the photo of one of the owner's listings. */
  async setListingImage(id: string, listingId: string, dto: ListingImageDto) {
    const business = await this.getOwned(id, dto?.ownerEmail);
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

  /** Starts PayPal onboarding and returns the link the owner opens. */
  async connectPaypal(id: string, ownerEmail: unknown) {
    const business = await this.getOwned(id, ownerEmail);
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
