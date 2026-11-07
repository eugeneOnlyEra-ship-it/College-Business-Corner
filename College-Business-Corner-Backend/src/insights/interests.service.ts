import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { extractTerms } from './terms.js';

/** A keyword must be searched this many times in the period before it is shown to anyone. */
export const MIN_REPORT_COUNT = 2;

const day = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => Number(v ?? 0);

/**
 * Anonymous demand tracking. One row per keyword per day with a counter: no user, no session, no IP,
 * no full sentence and no time of day. Raw SQL is used so the counter is one atomic upsert.
 */
@Injectable()
export class InterestsService implements OnModuleInit {
  private readonly logger = new Logger(InterestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Say so loudly at startup if the table is missing, instead of silently counting nothing. */
  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1 FROM "SearchInterest" LIMIT 1`;
    } catch (err) {
      this.logger.error(
        'The "SearchInterest" table is missing, so searches are NOT being counted and demand insights will be empty. ' +
          `Apply the latest migrations: npx prisma migrate deploy (${String((err as Error)?.message ?? err).slice(0, 80)})`,
      );
    }
  }

  /** Fire and forget: a tracking problem must never break a search. */
  record(...inputs: (string | null | undefined)[]): void {
    const terms = extractTerms(...inputs);
    if (!terms.length) return;
    const today = day(new Date());
    void Promise.all(
      terms.map(
        (term) => this.prisma.$executeRaw`
          INSERT INTO "SearchInterest" ("id", "day", "term", "count") VALUES (${randomUUID()}, ${today}, ${term}, 1)
          ON CONFLICT ("day", "term") DO UPDATE SET "count" = "count" + 1`,
      ),
    ).catch((err) => this.logger.warn(`Could not record search interest: ${String(err?.message ?? err).slice(0, 120)}`));
  }

  /** What students search for most lately, and how many listings already cover each keyword. */
  async insights(daysRaw?: number, limitRaw?: number) {
    const days = Math.min(Math.max(Math.round(daysRaw || 30), 1), 180);
    const limit = Math.min(Math.max(Math.round(limitRaw || 10), 1), 20);
    const since = day(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<{ term: string; searches: unknown }[]>`
        SELECT "term", SUM("count") AS "searches" FROM "SearchInterest"
        WHERE "day" >= ${since} GROUP BY "term" HAVING SUM("count") >= ${MIN_REPORT_COUNT}
        ORDER BY "searches" DESC, "term" ASC LIMIT ${limit}`,
      this.prisma.$queryRaw<{ total: unknown }[]>`SELECT SUM("count") AS "total" FROM "SearchInterest" WHERE "day" >= ${since}`,
    ]);

    const topSearches = await Promise.all(
      rows.map(async (r) => ({
        term: r.term,
        searches: num(r.searches),
        listingsAvailable: await this.prisma.listing.count({
          where: {
            active: true,
            OR: [
              { title: { contains: r.term } },
              { description: { contains: r.term } },
              { business: { name: { contains: r.term } } },
              { business: { category: { contains: r.term } } },
            ],
          },
        }),
      })),
    );

    return {
      periodDays: days,
      searchesCounted: num(totals[0]?.total),
      minimumSearchesToShow: MIN_REPORT_COUNT,
      topSearches,
      // Searched often and nobody sells it yet: the best places to start.
      unmetDemand: topSearches.filter((t) => t.listingsAvailable === 0),
      // Searched often and only one or two listings exist.
      lowSupply: topSearches.filter((t) => t.listingsAvailable >= 1 && t.listingsAvailable <= 2),
      note: topSearches.length
        ? 'Anonymous keyword counts from campus searches. Nothing here says who searched.'
        : 'Not enough campus searches recorded yet to show a pattern.',
    };
  }
}
