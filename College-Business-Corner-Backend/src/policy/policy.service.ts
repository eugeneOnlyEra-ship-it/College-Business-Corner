import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { effectiveLimits, MIN_LIMIT_CENTS, type PersonalLimits } from './limits.js';
import { evaluatePolicy, type PolicyLimits, type PolicyVerdict } from './policy.engine.js';

export type Actor = 'buyer' | 'agent' | 'system';
const ACTORS: Actor[] = ['buyer', 'agent', 'system'];

export interface PolicyRequest {
  items: unknown;
  budgetCents?: number;
  quotedTotalCents?: number;
  /** True only when the BUYER has explicitly approved an ASK. A BLOCK can never be confirmed. */
  confirmed?: boolean;
  actor?: Actor;
  action?: string;
  /** Whose personal limits apply. Without it the system limits are used. */
  buyerEmail?: string;
}

export interface PolicyResult extends PolicyVerdict {
  auditId: string;
  confirmedByBuyer: boolean;
}

const intFromEnv = (raw: unknown, fallback: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

@Injectable()
export class PolicyService {
  readonly limits: PolicyLimits;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const fee = Number(config.get('PLATFORM_FEE_PERCENT') ?? 10);
    this.limits = {
      hardCapCents: intFromEnv(config.get('POLICY_HARD_CAP_CENTS'), 10000),
      confirmAboveCents: intFromEnv(config.get('POLICY_CONFIRM_ABOVE_CENTS'), 5000),
      feePercent: Number.isFinite(fee) && fee >= 0 && fee <= 50 ? fee : 10,
    };
  }

  /** Decides, and writes the decision to the audit log (including blocked attempts). */
  async evaluate(req: PolicyRequest): Promise<PolicyResult> {
    const ids = Array.isArray(req.items)
      ? [...new Set((req.items as any[]).map((i) => i?.listingId).filter((x) => typeof x === 'string'))]
      : [];
    const found = ids.length
      ? await this.prisma.listing.findMany({ where: { id: { in: ids } }, include: { business: true } })
      : [];
    // A closed business is treated like a hidden listing: "no longer available".
    const listings = found.map((l) => ({ ...l, active: l.active && !l.business.closedAt }));

    const verdict = evaluatePolicy(
      req.items,
      listings,
      { budgetCents: req.budgetCents, quotedTotalCents: req.quotedTotalCents },
      await this.limitsFor(req.buyerEmail),
    );

    // Only an ASK can be confirmed by the buyer. BLOCK is final.
    const confirmedByBuyer = verdict.decision === 'ASK' && req.confirmed === true;
    const decision = confirmedByBuyer ? 'ALLOW' : verdict.decision;

    const summary = verdict.reasons.map((r) => r.message).join(' ') || 'No policy rules triggered.';
    const audit = await this.prisma.auditLog.create({
      data: {
        actor: req.actor && ACTORS.includes(req.actor) ? req.actor : 'buyer',
        buyerEmail: req.buyerEmail ?? null,
        action: req.action ?? 'checkout.request',
        decision,
        reason: confirmedByBuyer ? `Buyer confirmed. ${summary}` : summary,
        payload: JSON.stringify({
          items: req.items,
          budgetCents: req.budgetCents ?? null,
          quotedTotalCents: req.quotedTotalCents ?? null,
          totalCents: verdict.cart?.totalCents ?? null,
          reasons: verdict.reasons.map((r) => r.code),
          confirmedByBuyer,
        }),
      },
    });

    return { ...verdict, decision, auditId: audit.id, confirmedByBuyer };
  }

  /** The limits that apply to this buyer: the system's, made stricter by the buyer's own settings. */
  async limitsFor(buyerEmail?: string): Promise<PolicyLimits> {
    if (!buyerEmail) return this.limits;
    const user = await this.prisma.user.findUnique({ where: { email: buyerEmail }, select: { maxOrderCents: true, confirmAboveCents: true } });
    return effectiveLimits(this.limits, user);
  }

  /** What the buyer has set, what is actually in force, and the system ceiling. */
  async getLimits(buyerEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { email: buyerEmail }, select: { maxOrderCents: true, confirmAboveCents: true } });
    const personal: PersonalLimits = { maxOrderCents: user?.maxOrderCents ?? null, confirmAboveCents: user?.confirmAboveCents ?? null };
    const eff = effectiveLimits(this.limits, personal);
    return {
      maxOrderCents: personal.maxOrderCents,
      confirmAboveCents: personal.confirmAboveCents,
      effective: { maxOrderCents: eff.hardCapCents, confirmAboveCents: eff.confirmAboveCents },
      system: { maxOrderCents: this.limits.hardCapCents, confirmAboveCents: this.limits.confirmAboveCents },
    };
  }

  /** Replaces both personal limits. null clears one (back to the system default). */
  async setLimits(buyerEmail: string, body: { maxOrderCents?: unknown; confirmAboveCents?: unknown }) {
    const ceiling = this.limits.hardCapCents;
    const check = (raw: unknown, label: string): number | null => {
      if (raw === undefined || raw === null || raw === '') return null;
      if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < MIN_LIMIT_CENTS || raw > ceiling) {
        throw new BadRequestException(`${label} must be between $${(MIN_LIMIT_CENTS / 100).toFixed(2)} and $${(ceiling / 100).toFixed(2)}.`);
      }
      return raw;
    };
    const maxOrderCents = check(body?.maxOrderCents, 'Your maximum order');
    const confirmAboveCents = check(body?.confirmAboveCents, 'Your "ask me first" amount');
    if (maxOrderCents !== null && confirmAboveCents !== null && confirmAboveCents > maxOrderCents) {
      throw new BadRequestException('"Ask me first" cannot be higher than your maximum order.');
    }
    const user = await this.prisma.user.findUnique({ where: { email: buyerEmail } });
    if (!user) throw new BadRequestException('Please sign in again.');
    await this.prisma.user.update({ where: { id: user.id }, data: { maxOrderCents, confirmAboveCents } });
    return this.getLimits(buyerEmail);
  }

  /** A buyer's own decisions only, newest first. There is deliberately no way to read anyone else's. */
  recentAudit(buyerEmail: string, orderId?: string) {
    return this.prisma.auditLog.findMany({
      where: { buyerEmail, ...(orderId ? { orderId } : {}) },
      omit: { buyerEmail: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
