/**
 * What the OWNER agent is allowed to produce: PROPOSALS, never actions.
 * Pure functions (no Nest, no database) so the rules are easy to read and test.
 * The owner confirms a proposal in the app, which then calls the normal guarded endpoints,
 * and those check everything again.
 */
import { randomUUID } from 'node:crypto';

export const LIMITS = {
  maxBusinessesPerOwner: 5,
  maxListingsPerBusiness: 30,
  maxListingsPerProposal: 10,
  minPriceCents: 50,
  maxPriceCents: 10_000,
};

export interface OwnedListingView {
  id: string;
  title: string;
  priceCents: number;
  kind: string;
  unit: string | null;
  active: boolean;
}
export interface OwnedBusinessView {
  id: string;
  name: string;
  category: string;
  description: string;
  onboarding: string;
  listings: OwnedListingView[];
}

export interface ListingDraft {
  title: string;
  description: string;
  kind: 'PRODUCT' | 'SERVICE';
  priceCents: number;
  unit: string;
}
export type Proposal =
  | { id: string; type: 'business'; summary: string; data: { name: string; category: string; description: string } }
  | { id: string; type: 'listings'; summary: string; businessId: string; businessName: string; data: { listings: ListingDraft[] } }
  | {
      id: string;
      type: 'tip';
      summary: string;
      businessId: string;
      businessName: string;
      data: { term: string; searches: number; listingsAvailable: number; periodDays: number; fit: string; costLevel: CostLevel };
    }
  | { id: string; type: 'paypal'; summary: string; businessId: string; businessName: string; data: Record<string, never> };

export interface DemandSnapshot {
  periodDays: number;
  topSearches: { term: string; searches: number; listingsAvailable: number }[];
}
export const COST_LEVELS = ['none', 'low', 'medium', 'high', 'unknown'] as const;
export type CostLevel = (typeof COST_LEVELS)[number];

export type Checked = { ok: true; proposal: Proposal } | { ok: false; problems: string[] };

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export function validateBusiness(args: unknown, existing: OwnedBusinessView[]): Checked {
  const a = asRecord(args);
  const problems: string[] = [];
  const name = str(a.name, 60);
  const category = str(a.category, 30).toLowerCase();
  const description = str(a.description, 200);
  if (name.length < 2) problems.push('Business name must be 2 to 60 characters.');
  if (category.length < 2) problems.push('Category must be 2 to 30 characters, e.g. printing, salon, snacks.');
  if (existing.length >= LIMITS.maxBusinessesPerOwner) problems.push(`An owner can have at most ${LIMITS.maxBusinessesPerOwner} businesses.`);
  if (existing.some((b) => b.name.toLowerCase() === name.toLowerCase())) problems.push(`The owner already has a business called "${name}".`);
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    proposal: { id: randomUUID(), type: 'business', summary: `Create the business "${name}" (${category}).`, data: { name, category, description } },
  };
}

export function validateListings(args: unknown, businesses: OwnedBusinessView[]): Checked {
  const a = asRecord(args);
  const business = businesses.find((b) => b.id === a.businessId);
  if (!business) return { ok: false, problems: ['Unknown businessId. Call get_my_businesses and use one of its ids.'] };
  const raw = Array.isArray(a.listings) ? a.listings : [];
  const problems: string[] = [];
  if (raw.length < 1 || raw.length > LIMITS.maxListingsPerProposal) {
    return { ok: false, problems: [`Propose 1 to ${LIMITS.maxListingsPerProposal} listings at a time.`] };
  }
  const taken = new Set(business.listings.filter((l) => l.active).map((l) => l.title.toLowerCase()));
  const drafts: ListingDraft[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    const title = str(r.title, 80);
    const priceCents = typeof r.priceCents === 'number' ? Math.round(r.priceCents) : NaN;
    if (title.length < 2) { problems.push('Every listing needs a title of 2 to 80 characters.'); continue; }
    if (!Number.isInteger(priceCents) || priceCents < LIMITS.minPriceCents || priceCents > LIMITS.maxPriceCents) {
      problems.push(`"${title}": price must be between ${usd(LIMITS.minPriceCents)} and ${usd(LIMITS.maxPriceCents)} (PayPal sandbox limits for this app).`);
      continue;
    }
    if (taken.has(title.toLowerCase())) { problems.push(`"${title}" is already listed.`); continue; }
    taken.add(title.toLowerCase());
    drafts.push({
      title,
      description: str(r.description, 200),
      kind: r.kind === 'PRODUCT' ? 'PRODUCT' : 'SERVICE',
      priceCents,
      unit: str(r.unit, 30),
    });
  }
  if (business.listings.length + drafts.length > LIMITS.maxListingsPerBusiness) {
    problems.push(`A business can have at most ${LIMITS.maxListingsPerBusiness} listings.`);
  }
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    proposal: {
      id: randomUUID(),
      type: 'listings',
      businessId: business.id,
      businessName: business.name,
      summary: `Add ${drafts.length} listing${drafts.length === 1 ? '' : 's'} to ${business.name}.`,
      data: { listings: drafts },
    },
  };
}

export function validatePaypalConnect(args: unknown, businesses: OwnedBusinessView[]): Checked {
  const a = asRecord(args);
  const business = businesses.find((b) => b.id === a.businessId);
  if (!business) return { ok: false, problems: ['Unknown businessId. Call get_my_businesses and use one of its ids.'] };
  if (business.onboarding === 'READY') {
    return { ok: false, problems: ['This business is already connected to PayPal. Tell the owner it is ready to get paid.'] };
  }
  return {
    ok: true,
    proposal: {
      id: randomUUID(),
      type: 'paypal',
      businessId: business.id,
      businessName: business.name,
      summary: `Connect ${business.name} to PayPal so customers can pay it.`,
      data: {},
    },
  };
}

/**
 * An expansion tip: something students keep searching for that this business does not offer yet.
 * The numbers come from the real demand data, never from the model, so a tip cannot be invented.
 */
export function validateTip(args: unknown, businesses: OwnedBusinessView[], demand: DemandSnapshot): Checked {
  const a = asRecord(args);
  const business = businesses.find((b) => b.id === a.businessId);
  if (!business) return { ok: false, problems: ['Unknown businessId. Call get_my_businesses and use one of its ids.'] };
  const term = str(a.term, 40).toLowerCase();
  const found = demand.topSearches.find((t) => t.term === term);
  const problems: string[] = [];
  if (!found) problems.push('That keyword is not in the demand data. Use a term exactly as returned by get_demand_insights.');
  const fit = str(a.fit, 160);
  if (fit.length < 5) problems.push('Add a short "fit" sentence saying why this suits this business.');
  const covered =
    term.length > 0 &&
    (business.category.toLowerCase().includes(term) ||
      business.listings.some((l) => l.active && l.title.toLowerCase().includes(term)));
  if (covered) problems.push('This business already offers that. Pick a different keyword.');
  if (problems.length || !found) return { ok: false, problems };
  const costLevel = (COST_LEVELS as readonly string[]).includes(a.costLevel as string) ? (a.costLevel as CostLevel) : 'unknown';
  return {
    ok: true,
    proposal: {
      id: randomUUID(),
      type: 'tip',
      businessId: business.id,
      businessName: business.name,
      summary: `Tip for ${business.name}: students keep searching for "${term}".`,
      data: { term, searches: found.searches, listingsAvailable: found.listingsAvailable, periodDays: demand.periodDays, fit, costLevel },
    },
  };
}
