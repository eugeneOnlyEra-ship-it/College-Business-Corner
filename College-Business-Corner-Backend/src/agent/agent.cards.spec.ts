import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
// Pretend to be the AI: run the tools it would call, then answer.
let script: (run: (name: string, args: any) => Promise<unknown>) => Promise<string> = async () => '';
vi.mock('./agent.loop.js', async (orig) => ({
  ...(await orig<typeof import('./agent.loop.js')>()),
  runAgentLoop: vi.fn(async (opts: any) => ({ reply: await script(opts.executeTool), steps: [], finished: true })),
}));
import { AgentService } from './agent.service.js';

const L = (id: string, title: string, priceCents: number, biz = 'b1') => ({
  id, title, description: `${title} details`, kind: 'SERVICE' as const, priceCents, unit: 'per load', imageUrl: `/img/${id}.jpg`,
  business: { id: biz, name: `Biz ${biz}`, category: 'laundry', description: 'about', canReceivePayments: true },
});

function make(search: (q: any) => any, createOrder: any = vi.fn()) {
  const config = { get: (k: string) => (k === 'GEMINI_API_KEY' ? 'test-key' : undefined) };
  return new AgentService(config as never, { search: vi.fn(async (a) => search(a)) } as never, { createOrder } as never);
}

describe('AgentService shows what it found as cards', () => {
  it('returns the real listings (with photo and business id) for each search, top 4 per search', async () => {
    const svc = make(() => [1, 2, 3, 4, 5, 6].map((n) => L(`l${n}`, `Wash ${n}`, n * 100)));
    script = async (run) => { await run('search_listings', { q: 'laundry' }); return 'Here are some options.'; };
    const r = await svc.chat({ message: 'I need laundry services' } as never);
    expect(r.listings.map((l: any) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4']);
    expect(r.listings[0]).toMatchObject({ title: 'Wash 1', imageUrl: '/img/l1.jpg', business: { id: 'b1', name: 'Biz b1' } });
    expect(r.selectedIds).toEqual([]);
    expect(r.checkout).toBeNull();
  });

  it('combines several searches without duplicates', async () => {
    const svc = make(({ q }) => (q === 'laundry' ? [L('a', 'Laundry', 1500), L('b', 'Bag', 2000)] : [L('b', 'Bag', 2000), L('c', 'Haircut', 1200, 'b2')]));
    script = async (run) => { await run('search_listings', { q: 'laundry' }); await run('search_listings', { q: 'haircut' }); return 'ok'; };
    const r = await svc.chat({ message: 'laundry and a haircut' } as never);
    expect(r.listings.map((l: any) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('always includes what went into the cart and marks it selected, even if it ranked low', async () => {
    const createOrder = vi.fn(async () => ({ decision: 'ALLOW', orderId: 'o1', approveUrl: 'https://paypal.test' }));
    const svc = make(() => [1, 2, 3, 4, 5, 6].map((n) => L(`l${n}`, `Wash ${n}`, n * 100)), createOrder);
    script = async (run) => {
      await run('search_listings', { q: 'laundry' });
      await run('request_checkout', { items: [{ listingId: 'l6', quantity: 1 }], budgetCents: 2000 });
      return 'Cart ready.';
    };
    const r = await svc.chat({ message: 'laundry, budget $20' } as never);
    expect(r.listings.map((l: any) => l.id)).toEqual(['l1', 'l2', 'l3', 'l4', 'l6']);
    expect(r.selectedIds).toEqual(['l6']);
  });

  it('ignores invented listing ids and returns no cards when nothing was searched', async () => {
    const createOrder = vi.fn(async () => ({ decision: 'BLOCK' }));
    const svc = make(() => [], createOrder);
    script = async (run) => { await run('request_checkout', { items: [{ listingId: 'made-up', quantity: 1 }] }); return 'Sorry.'; };
    const r = await svc.chat({ message: 'something' } as never);
    expect(r.listings).toEqual([]);
    expect(r.selectedIds).toEqual([]);
  });
});
