import { validateBusiness, validateListings, validatePaypalConnect, validateTip, type DemandSnapshot, type Checked, type OwnedBusinessView, type Proposal } from './owner-proposals.js';

/** Tool declarations shown to the model. It can read and PROPOSE. It has no tool that saves or sends anything. */
export const OWNER_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_my_businesses',
        description: "Read the signed-in owner's businesses: id, name, category, PayPal setup state (NOT_STARTED, PENDING or READY) and listings (id, title, price in cents, unit, active).",
        parametersJsonSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_paypal_status',
        description: "Ask PayPal where a business is in the PayPal setup. Returns what is done and, in plain words, what is still missing.",
        parametersJsonSchema: {
          type: 'object',
          properties: { businessId: { type: 'string' } },
          required: ['businessId'],
        },
      },
      {
        name: 'get_demand_insights',
        description:
          'Anonymous campus demand: the keywords students searched for most lately, how many listings already cover each, and which are searched often with no listings (unmetDemand). Use it to suggest business ideas to an owner who does not know what to sell. It never says who searched.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Look back this many days. Default 30.' },
            limit: { type: 'integer', description: 'How many keywords. Default 10.' },
          },
        },
      },
      {
        name: 'get_starter_resources',
        description:
          'Beginner tips, books and websites for new student entrepreneurs, from a checked list. Call it when the owner asks for tips, books, websites, resources or how to get started, says they are new to business, or says yes to your offer of beginner resources. The app shows the full list with links in a card, so just mention one or two highlights.',
        parametersJsonSchema: { type: 'object', properties: {} },
      },
      {
        name: 'propose_business',
        description: 'Propose registering a new business. The owner must confirm before it exists.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Business name, 2 to 60 characters.' },
            category: { type: 'string', description: 'One or two words, e.g. printing, salon, snacks, repairs, tutoring.' },
            description: { type: 'string', description: 'One friendly sentence about what it offers, up to 200 characters.' },
          },
          required: ['name', 'category'],
        },
      },
      {
        name: 'propose_listings',
        description: 'Propose adding 1 to 10 listings to one of the owner\'s businesses. Prices are in cents. The owner must confirm before they are saved.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            businessId: { type: 'string' },
            listings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Short and clear, e.g. "Black and white printing".' },
                  description: { type: 'string', description: 'Up to 200 characters. Optional.' },
                  kind: { type: 'string', enum: ['PRODUCT', 'SERVICE'] },
                  priceCents: { type: 'integer', description: 'Between 50 and 10000 (that is $0.50 to $100.00).' },
                  unit: { type: 'string', description: 'What the price covers, e.g. "per 40 pages", "per haircut". Optional.' },
                },
                required: ['title', 'kind', 'priceCents'],
              },
            },
          },
          required: ['businessId', 'listings'],
        },
      },
      {
        name: 'propose_tip',
        description:
          'Show the owner a special expansion tip: something students keep searching for that this business does not offer yet. The numbers are filled in from the real demand data. Use a term exactly as returned by get_demand_insights. The owner can tap to add it if they want.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            businessId: { type: 'string' },
            term: { type: 'string', description: 'A keyword exactly as returned by get_demand_insights.' },
            fit: { type: 'string', description: 'One short sentence on why this suits THIS business, up to 160 characters.' },
            costLevel: {
              type: 'string',
              enum: ['none', 'low', 'medium', 'high', 'unknown'],
              description: 'Your rough estimate of the start-up cost. Use "unknown" if unsure. It is shown to the owner as an estimate.',
            },
          },
          required: ['businessId', 'term', 'fit'],
        },
      },
      {
        name: 'propose_paypal_connect',
        description:
          'Propose starting the PayPal connection for one of the owner\'s businesses. The owner confirms, then gets a link to approve in PayPal. Use it when the business is not READY.',
        parametersJsonSchema: {
          type: 'object',
          properties: { businessId: { type: 'string' } },
          required: ['businessId'],
        },
      },
    ],
  },
];

export interface OwnerToolDeps {
  getBusinesses(): Promise<OwnedBusinessView[]>;
  getPaypalStatus(businessId: string): Promise<unknown>;
  getDemandInsights(args: { days?: number; limit?: number }): Promise<DemandSnapshot>;
}

/** Returns the tool executor. Valid proposals are collected into `proposals` for the app to show. */
export function createOwnerToolExecutor(deps: OwnerToolDeps, proposals: Proposal[]) {
  const keep = (checked: Checked) => {
    if (!checked.ok) return { accepted: false, problems: checked.problems };
    const p = checked.proposal;
    const key = (x: Proposal) => JSON.stringify([x.type, 'businessId' in x ? x.businessId : '', x.data]);
    if (!proposals.some((q) => key(q) === key(p))) proposals.push(p);
    return { accepted: true, note: 'Shown to the owner as a card to confirm. Nothing is saved or sent yet.' };
  };

  return async (name: string, args: any): Promise<unknown> => {
    if (name === 'get_my_businesses') return deps.getBusinesses();

    if (name === 'get_demand_insights') return deps.getDemandInsights({ days: args?.days, limit: args?.limit });

    if (name === 'get_paypal_status') {
      const businesses = await deps.getBusinesses();
      if (!businesses.some((b) => b.id === args?.businessId)) return { error: 'Unknown businessId.' };
      return deps.getPaypalStatus(args.businessId);
    }

    if (name === 'propose_business') return keep(validateBusiness(args, await deps.getBusinesses()));
    if (name === 'propose_listings') return keep(validateListings(args, await deps.getBusinesses()));
    if (name === 'propose_tip') return keep(validateTip(args, await deps.getBusinesses(), await deps.getDemandInsights({ limit: 20 })));
    if (name === 'propose_paypal_connect') return keep(validatePaypalConnect(args, await deps.getBusinesses()));

    return { error: `Unknown tool: ${name}` };
  };
}
