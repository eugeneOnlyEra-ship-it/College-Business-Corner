/** Tool declarations shown to the model. The model can propose; it can never pay or confirm. */
export const AGENT_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'search_listings',
        description:
          'Search active campus business listings. Returns id, title, price in cents, business name and category, and whether the business can receive PayPal payments.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            q: { type: 'string', description: 'What to look for, e.g. "printing", "haircut", "ride".' },
            maxPriceCents: { type: 'integer', description: 'Only return listings at or below this price, in cents.' },
          },
          required: ['q'],
        },
      },
      {
        name: 'request_checkout',
        description:
          'Submit the chosen cart for checkout. The safety rules decide ALLOW, ASK or BLOCK. On ALLOW a payment link is prepared for the student to approve. You cannot confirm an ASK or override a BLOCK.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              description: 'The cart: listing ids from search_listings and quantities.',
              items: {
                type: 'object',
                properties: {
                  listingId: { type: 'string' },
                  quantity: { type: 'integer' },
                },
                required: ['listingId', 'quantity'],
              },
            },
            budgetCents: {
              type: 'integer',
              description: "The student's stated budget in cents. Always include it when they gave one.",
            },
          },
          required: ['items'],
        },
      },
    ],
  },
];
