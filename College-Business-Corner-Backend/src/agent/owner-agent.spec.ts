import { describe, expect, it } from 'vitest';
import { runAgentLoop } from './agent.loop.js';
import { createOwnerToolExecutor, OWNER_TOOLS } from './owner-tools.js';
import { validateBusiness, validateListings, validatePaypalConnect, validateTip, type OwnedBusinessView, type Proposal } from './owner-proposals.js';

const biz = (over: Partial<OwnedBusinessView> = {}): OwnedBusinessView => ({
  id: 'b1', name: 'Print Hub', category: 'printing', description: '', onboarding: 'READY',
  listings: [{ id: 'l1', title: 'Black and white printing', priceCents: 250, kind: 'SERVICE', unit: 'per 40 pages', active: true }],
  ...over,
});

describe('validateListings', () => {
  it('accepts clean listings and defaults the kind to SERVICE', () => {
    const r = validateListings({ businessId: 'b1', listings: [{ title: 'Braids', priceCents: 1500 }] }, [biz()]);
    expect(r.ok).toBe(true);
    if (r.ok && r.proposal.type === 'listings') expect(r.proposal.data.listings[0].kind).toBe('SERVICE');
  });
  it('rejects prices outside $0.50 to $100', () => {
    const r = validateListings({ businessId: 'b1', listings: [{ title: 'Big job', priceCents: 20000 }, { title: 'Tiny', priceCents: 10 }] }, [biz()]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems).toHaveLength(2);
  });
  it('rejects duplicates of existing listings and unknown businesses', () => {
    expect(validateListings({ businessId: 'b1', listings: [{ title: 'black and white PRINTING', priceCents: 300 }] }, [biz()]).ok).toBe(false);
    expect(validateListings({ businessId: 'nope', listings: [{ title: 'X1', priceCents: 300 }] }, [biz()]).ok).toBe(false);
  });
  it('rejects more than 10 listings in one proposal', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ title: `Item ${i}`, priceCents: 100 }));
    expect(validateListings({ businessId: 'b1', listings: many }, [biz()]).ok).toBe(false);
  });
});

describe('validatePaypalConnect', () => {
  it('proposes connecting a business that is not ready', () => {
    expect(validatePaypalConnect({ businessId: 'b1' }, [biz({ onboarding: 'NOT_STARTED' })]).ok).toBe(true);
    expect(validatePaypalConnect({ businessId: 'b1' }, [biz({ onboarding: 'PENDING' })]).ok).toBe(true);
  });
  it('does not propose it when already ready, or for an unknown business', () => {
    expect(validatePaypalConnect({ businessId: 'b1' }, [biz()]).ok).toBe(false);
    expect(validatePaypalConnect({ businessId: 'zzz' }, [biz()]).ok).toBe(false);
  });
});

describe('validateTip', () => {
  const demand = { periodDays: 30, topSearches: [{ term: 'laundry', searches: 7, listingsAvailable: 0 }, { term: 'printing', searches: 5, listingsAvailable: 1 }] };
  it('takes the numbers from the real demand data', () => {
    const r = validateTip({ businessId: 'b1', term: 'laundry', fit: 'Students near you also need clean clothes.', costLevel: 'low', searches: 999 }, [biz()], demand);
    expect(r.ok).toBe(true);
    if (r.ok && r.proposal.type === 'tip') {
      expect(r.proposal.data.searches).toBe(7);
      expect(r.proposal.data.listingsAvailable).toBe(0);
      expect(r.proposal.data.costLevel).toBe('low');
    }
  });
  it('refuses an invented keyword, a missing reason, or something the business already offers', () => {
    expect(validateTip({ businessId: 'b1', term: 'rocket fuel', fit: 'Sounds fun to try.' }, [biz()], demand).ok).toBe(false);
    expect(validateTip({ businessId: 'b1', term: 'laundry', fit: '' }, [biz()], demand).ok).toBe(false);
    expect(validateTip({ businessId: 'b1', term: 'printing', fit: 'You already do this.' }, [biz()], demand).ok).toBe(false);
  });
  it('falls back to an unknown cost level when the model gives nonsense', () => {
    const r = validateTip({ businessId: 'b1', term: 'laundry', fit: 'Fits your customers.', costLevel: 'free money' }, [biz()], demand);
    if (r.ok && r.proposal.type === 'tip') expect(r.proposal.data.costLevel).toBe('unknown');
  });
});

describe('validateBusiness', () => {
  it('accepts a normal business and rejects duplicates', () => {
    expect(validateBusiness({ name: 'Snack Shack', category: 'Snacks' }, [biz()]).ok).toBe(true);
    expect(validateBusiness({ name: 'print hub', category: 'printing' }, [biz()]).ok).toBe(false);
  });
});

describe('owner agent end to end (fake model)', () => {
  const deps = (businesses: OwnedBusinessView[]) => ({
    getBusinesses: async () => businesses,
    getPaypalStatus: async () => ({ onboarding: 'READY', fixes: [] }),
    getDemandInsights: async () => ({ periodDays: 30, topSearches: [{ term: 'haircut', searches: 7, listingsAvailable: 0 }], unmetDemand: [{ term: 'haircut', searches: 7, listingsAvailable: 0 }] }),
  });

  it('has no tool that saves or sends anything', () => {
    const names = OWNER_TOOLS[0].functionDeclarations.map((d) => d.name);
    expect(names.sort()).toEqual(['get_demand_insights', 'get_my_businesses', 'get_paypal_status', 'get_starter_resources', 'propose_business', 'propose_listings', 'propose_paypal_connect', 'propose_tip']);
  });

  it('collects proposals while the model works, and does not duplicate them', async () => {
    const proposals: Proposal[] = [];
    const exec = createOwnerToolExecutor(deps([biz()]), proposals);
    const call = { name: 'propose_listings', args: { businessId: 'b1', listings: [{ title: 'Braids', priceCents: 1500, kind: 'SERVICE' }] } };
    const replies = [{ functionCalls: [call, call] }, { text: "I've prepared it for you to confirm." }];
    const client = { models: { generateContent: async () => replies.shift() } };
    const out = await runAgentLoop({ client, model: 'x', systemInstruction: 's', tools: OWNER_TOOLS, contents: [{ role: 'user', parts: [{ text: 'braids 15' }] }], executeTool: exec });
    expect(out.finished).toBe(true);
    expect(proposals).toHaveLength(1);
  });

  it('hands problems back to the model instead of making a card', async () => {
    const proposals: Proposal[] = [];
    const exec = createOwnerToolExecutor(deps([biz()]), proposals);
    const r = (await exec('propose_listings', { businessId: 'b1', listings: [{ title: 'Huge', priceCents: 999999 }] })) as any;
    expect(r.accepted).toBe(false);
    expect(proposals).toHaveLength(0);
  });

  it('can read anonymous demand insights for an owner who has no idea what to sell', async () => {
    const exec = createOwnerToolExecutor(deps([]), []);
    const r = (await exec('get_demand_insights', { days: 30 })) as any;
    expect(r.unmetDemand[0].term).toBe('haircut');
    expect(JSON.stringify(r)).not.toMatch(/email|user/i);
  });

  it("will not read PayPal status for a business the owner doesn't have", async () => {
    const exec = createOwnerToolExecutor(deps([biz()]), []);
    expect(await exec('get_paypal_status', { businessId: 'someone-elses' })).toEqual({ error: 'Unknown businessId.' });
  });
});
