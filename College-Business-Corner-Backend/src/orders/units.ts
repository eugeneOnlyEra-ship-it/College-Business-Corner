/** Helpers for paying several businesses that may share one PayPal account. */

export interface SellerLike {
  merchantId: string;
  amountCents: number;
  platformFeeCents: number;
  description: string;
}

/** PayPal gets ONE purchase unit per PayPal account, even if the buyer is paying several businesses behind it. */
export function mergeByMerchant<T extends SellerLike>(sellers: T[]): SellerLike[] {
  const byMerchant = new Map<string, SellerLike>();
  for (const s of sellers) {
    const existing = byMerchant.get(s.merchantId);
    if (existing) {
      existing.amountCents += s.amountCents;
      existing.platformFeeCents += s.platformFeeCents;
      existing.description += `; ${s.description}`;
    } else {
      byMerchant.set(s.merchantId, {
        merchantId: s.merchantId,
        amountCents: s.amountCents,
        platformFeeCents: s.platformFeeCents,
        description: s.description,
      });
    }
  }
  return [...byMerchant.values()].map((s) => ({ ...s, description: s.description.slice(0, 127) }));
}

/** Splits a total across weights in whole cents so the parts always add up to the total. */
export function apportion(total: number | null, weights: number[]): (number | null)[] {
  if (total === null || total === undefined) return weights.map(() => null);
  if (weights.length === 1) return [total];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let left = total - parts.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    parts[i] += 1;
    left -= 1;
  }
  return parts;
}
