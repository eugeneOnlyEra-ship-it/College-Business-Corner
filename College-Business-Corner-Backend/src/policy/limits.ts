import type { PolicyLimits } from './policy.engine.js';

export interface PersonalLimits {
  maxOrderCents: number | null;
  confirmAboveCents: number | null;
}

/** Smallest limit a buyer can set (50 cents, like the cheapest listing). */
export const MIN_LIMIT_CENTS = 50;

/**
 * The limits actually used for one buyer. A buyer can only make the rules STRICTER than the system's:
 * their maximum order can never go above the system cap, and "ask me first" can never be above their own maximum.
 */
export function effectiveLimits(system: PolicyLimits, personal?: Partial<PersonalLimits> | null): PolicyLimits {
  const hardCapCents = personal?.maxOrderCents ? Math.min(system.hardCapCents, personal.maxOrderCents) : system.hardCapCents;
  const wantedConfirm = personal?.confirmAboveCents ?? system.confirmAboveCents;
  return { ...system, hardCapCents, confirmAboveCents: Math.min(wantedConfirm, hardCapCents) };
}
