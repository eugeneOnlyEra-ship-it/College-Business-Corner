import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient, type ListingKind } from './generated/prisma/client.js';

/**
 * Demo data. Safe to run repeatedly (upserts / skips existing rows).
 *
 * Two sellers are linked to PayPal SANDBOX merchant accounts that were onboarded to the platform.
 * If you use your own PayPal sandbox app, onboard your own sellers (POST /paypal/onboard) and
 * set SEED_PRINT_MERCHANT_ID / SEED_SALON_MERCHANT_ID in .env before seeding.
 * The transport business is deliberately NOT onboarded: the policy engine should block paying it.
 */
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const PRINT_MERCHANT = process.env.SEED_PRINT_MERCHANT_ID ?? 'NR94ASH7KHULQ';
const SALON_MERCHANT = process.env.SEED_SALON_MERCHANT_ID ?? 'MTP98HKC3YJDC';

interface SeedListing {
  title: string;
  description: string;
  kind: ListingKind;
  priceCents: number;
  unit: string;
}

async function seedBusiness(opts: {
  ownerEmail: string;
  ownerName: string;
  trackingId: string;
  name: string;
  category: string;
  description: string;
  merchantId: string | null;
  listings: SeedListing[];
}) {
  const owner = await prisma.user.upsert({
    where: { email: opts.ownerEmail },
    update: {},
    create: { email: opts.ownerEmail, name: opts.ownerName },
  });

  const business = await prisma.business.upsert({
    where: { paypalTrackingId: opts.trackingId },
    update: {
      paypalMerchantId: opts.merchantId,
      onboarding: opts.merchantId ? 'READY' : 'NOT_STARTED',
    },
    create: {
      ownerId: owner.id,
      name: opts.name,
      category: opts.category,
      description: opts.description,
      paypalTrackingId: opts.trackingId,
      paypalMerchantId: opts.merchantId,
      onboarding: opts.merchantId ? 'READY' : 'NOT_STARTED',
    },
  });

  for (const l of opts.listings) {
    const exists = await prisma.listing.findFirst({
      where: { businessId: business.id, title: l.title },
    });
    if (!exists) {
      await prisma.listing.create({ data: { ...l, businessId: business.id } });
    }
  }
  return business;
}

async function main() {
  await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: { email: 'student@example.com', name: 'Demo Student' },
  });

  await seedBusiness({
    ownerEmail: 'print.owner@example.com',
    ownerName: 'Print Hub Owner',
    trackingId: 'seed-print-hub',
    name: 'Campus Print Hub',
    category: 'printing',
    description: 'Fast, cheap printing and binding for assignments.',
    merchantId: PRINT_MERCHANT,
    listings: [
      { title: 'Black & white printing (40 pages)', description: 'A4, single sided, black and white printing.', kind: 'SERVICE', priceCents: 1000, unit: 'per 40 pages' },
      { title: 'Colour printing (10 pages)', description: 'A4 full colour printing.', kind: 'SERVICE', priceCents: 800, unit: 'per 10 pages' },
      { title: 'Spiral binding', description: 'Spiral bind a document up to 100 pages.', kind: 'SERVICE', priceCents: 500, unit: 'per document' },
    ],
  });

  await seedBusiness({
    ownerEmail: 'salon.owner@example.com',
    ownerName: 'Salon Owner',
    trackingId: 'seed-fresh-cuts',
    name: 'Fresh Cuts Salon',
    category: 'salon',
    description: 'Student-run barber and hair salon, appointments on weekends.',
    merchantId: SALON_MERCHANT,
    listings: [
      { title: 'Haircut', description: 'Standard haircut and style.', kind: 'SERVICE', priceCents: 1500, unit: 'per haircut' },
      { title: 'Beard trim', description: 'Beard shaping and trim.', kind: 'SERVICE', priceCents: 700, unit: 'per trim' },
    ],
  });

  await seedBusiness({
    ownerEmail: 'rides.owner@example.com',
    ownerName: 'Rides Owner',
    trackingId: 'seed-campus-rides',
    name: 'Campus Rides',
    category: 'transport',
    description: 'Shared rides from campus to town. (Not yet onboarded to PayPal.)',
    merchantId: null,
    listings: [
      { title: 'Ride to town centre', description: 'Shared ride, leaves from the main gate.', kind: 'SERVICE', priceCents: 800, unit: 'per seat' },
    ],
  });

  const [users, businesses, listings] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.listing.count(),
  ]);
  console.log(`Seed complete: ${users} users, ${businesses} businesses, ${listings} listings.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
