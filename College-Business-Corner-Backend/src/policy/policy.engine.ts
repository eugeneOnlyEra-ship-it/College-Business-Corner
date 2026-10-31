import { centsToDecimal } from '../common/money.js';
import {
  MAX_LINES,
  MAX_QUANTITY,
  priceCart,
  type CartLineInput,
  type PricedCart,
  type PricedListing,
} from '../orders/pricing.js';

/**
 * The policy engine: plain, deterministic rules that decide whether a proposed checkout may
 * go ahead. No AI, no database, no network, so it is easy to test and to explain.
 *
 *   BLOCK = never allowed (cannot be overridden by anyone)
 *   ASK   = the buyer must explicitly confirm first
 *   ALLOW = fine to create the payment
 */

export type PolicyDecision = 'ALLOW' | 'ASK' | 'BLOCK';

export type PolicyReasonCode =
  | 'BAD_INPUT'
  | 'EMPTY_CART'
  | 'TOO_MANY_ITEMS'
  | 'BAD_QUANTITY'
  | 'UNKNOWN_LISTING'
  | 'LISTING_INACTIVE'
  | 'UNSUPPORTED_CURRENCY'
  | 'SELLER_NOT_CONNECTED'
  | 'OVER_HARD_CAP'
  | 'OVER_BUDGET'
  | 'LARGE_ORDER'
  | 'PRICE_CHANGED';

export interface PolicyReason {
  code: PolicyReasonCode;
  severity: 'BLOCK' | 'ASK';
  message: string;
}

export interface PolicyLimits {
  /** Orders above this total (in cents) are always blocked. */
  hardCapCents: number;
  /** Orders above this total (in cents) need the buyer's confirmation. */
  confirmAboveCents: number;
  feePercent: number;
}

export interface PolicyContext {
  /** The budget the buyer stated, in cents (e.g. "under $25"). */
  budgetCents?: number;
  /** The total the buyer was quoted earlier, in cents. A different total means prices moved. */
  quotedTotalCents?: number;
}

export interface PolicyVerdict {
  decision: PolicyDecision;
  reasons: PolicyReason[];
  /** Present unless the decision is BLOCK. */
  cart?: PricedCart;
}

const usd = (cents: number) => `$${centsToDecimal(cents)}`;

export function evaluatePolicy(
  items: unknown,
  listings: PricedListing[],
  ctx: PolicyContext,
  limits: PolicyLimits,
): PolicyVerdict {
  const reasons: PolicyReason[] = [];
  const block = (code: PolicyReasonCode, message: string) =>
    reasons.push({ code, severity: 'BLOCK', message });
  const ask = (code: PolicyReasonCode, message: string) =>
    reasons.push({ code, severity: 'ASK', message });

  // ---- 1. input shape -------------------------------------------------------------------
  if (!Array.isArray(items) || items.length === 0) {
    block('EMPTY_CART', 'The order has no items.');
    return { decision: 'BLOCK', reasons };
  }
  if (items.length > MAX_LINES) {
    block('TOO_MANY_ITEMS', `An order can have at most ${MAX_LINES} items.`);
  }
  if (ctx.budgetCents !== undefined && (!Number.isInteger(ctx.budgetCents) || ctx.budgetCents <= 0)) {
    block('BAD_INPUT', 'The budget must be a positive whole number of cents.');
  }
  if (
    ctx.quotedTotalCents !== undefined &&
    (!Number.isInteger(ctx.quotedTotalCents) || ctx.quotedTotalCents <= 0)
  ) {
    block('BAD_INPUT', 'The quoted total must be a positive whole number of cents.');
  }

  const lines: CartLineInput[] = [];
  for (const raw of items as any[]) {
    if (!raw || typeof raw.listingId !== 'string' || !raw.listingId) {
      block('BAD_INPUT', 'Every item needs a listingId.');
      continue;
    }
    if (!Number.isInteger(raw.quantity) || raw.quantity < 1 || raw.quantity > MAX_QUANTITY) {
      block('BAD_QUANTITY', `Quantity must be a whole number from 1 to ${MAX_QUANTITY}.`);
      continue;
    }
    lines.push({ listingId: raw.listingId, quantity: raw.quantity });
  }

  // ---- 2. every listing must exist, be active, in USD, and sold by a PayPal-ready business -
  const byId = new Map(listings.map((l) => [l.id, l]));
  for (const id of new Set(lines.map((l) => l.listingId))) {
    const listing = byId.get(id);
    if (!listing) {
      block('UNKNOWN_LISTING', `Listing ${id} does not exist.`);
      continue;
    }
    if (!listing.active) {
      block('LISTING_INACTIVE', `"${listing.title}" is no longer available.`);
    }
    if (listing.currency !== 'USD') {
      block('UNSUPPORTED_CURRENCY', `"${listing.title}" is not priced in USD.`);
    }
    if (listing.business.onboarding !== 'READY' || !listing.business.paypalMerchantId) {
      block(
        'SELLER_NOT_CONNECTED',
        `${listing.business.name} is not connected to PayPal yet, so "${listing.title}" cannot be paid for.`,
      );
    }
  }

  if (reasons.some((r) => r.severity === 'BLOCK')) {
    return { decision: 'BLOCK', reasons };
  }

  // ---- 3. price the cart (cannot throw now: all the checks above passed) -----------------
  const cart = priceCart(lines, listings, limits.feePercent);

  // ---- 4. spending rules -----------------------------------------------------------------
  if (cart.totalCents > limits.hardCapCents) {
    block(
      'OVER_HARD_CAP',
      `The total ${usd(cart.totalCents)} is above the ${usd(limits.hardCapCents)} limit for a single order.`,
    );
    return { decision: 'BLOCK', reasons, cart };
  }

  if (ctx.budgetCents !== undefined && cart.totalCents > ctx.budgetCents) {
    ask(
      'OVER_BUDGET',
      `The total ${usd(cart.totalCents)} is over the stated budget of ${usd(ctx.budgetCents)}.`,
    );
  }
  if (ctx.quotedTotalCents !== undefined && cart.totalCents !== ctx.quotedTotalCents) {
    ask(
      'PRICE_CHANGED',
      `The total is now ${usd(cart.totalCents)} but ${usd(ctx.quotedTotalCents)} was quoted.`,
    );
  }
  if (cart.totalCents > limits.confirmAboveCents) {
    ask(
      'LARGE_ORDER',
      `The total ${usd(cart.totalCents)} is above ${usd(limits.confirmAboveCents)}, which needs confirmation.`,
    );
  }

  return { decision: reasons.length > 0 ? 'ASK' : 'ALLOW', reasons, cart };
}
