import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
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
    const listings = ids.length
      ? await this.prisma.listing.findMany({ where: { id: { in: ids } }, include: { business: true } })
      : [];

    const verdict = evaluatePolicy(
      req.items,
      listings,
      { budgetCents: req.budgetCents, quotedTotalCents: req.quotedTotalCents },
      this.limits,
    );

    // Only an ASK can be confirmed by the buyer. BLOCK is final.
    const confirmedByBuyer = verdict.decision === 'ASK' && req.confirmed === true;
    const decision = confirmedByBuyer ? 'ALLOW' : verdict.decision;

    const summary = verdict.reasons.map((r) => r.message).join(' ') || 'No policy rules triggered.';
    const audit = await this.prisma.auditLog.create({
      data: {
        actor: req.actor && ACTORS.includes(req.actor) ? req.actor : 'buyer',
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

  recentAudit(orderId?: string) {
    return this.prisma.auditLog.findMany({
      where: orderId ? { orderId } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
