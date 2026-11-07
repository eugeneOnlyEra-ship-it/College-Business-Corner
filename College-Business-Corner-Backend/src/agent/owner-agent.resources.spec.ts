import { describe, expect, it, vi } from 'vitest';

vi.mock('../prisma/prisma.service.js', () => ({ PrismaService: class {} }));
vi.mock('../paypal/paypal.service.js', () => ({ PaypalService: class {} }));
let script: (run: (name: string, args: any) => Promise<unknown>) => Promise<string> = async () => '';
const seenByModel: unknown[] = [];
vi.mock('./agent.loop.js', async (orig) => ({
  ...(await orig<typeof import('./agent.loop.js')>()),
  runAgentLoop: vi.fn(async (opts: any) => ({
    reply: await script(async (n, a) => { const r = await opts.executeTool(n, a); seenByModel.push(r); return r; }),
    steps: [], finished: true,
  })),
}));
import { OwnerAgentService } from './owner-agent.service.js';

const make = () => new OwnerAgentService(
  { get: (k: string) => (k === 'GEMINI_API_KEY' ? 'key' : undefined) } as never,
  { listForOwner: vi.fn().mockResolvedValue([]) } as never,
  { insights: vi.fn() } as never,
);

describe('business assistant: starter resources', () => {
  it('attaches the checked list when the assistant asks for it', async () => {
    const r = await make().chat({ message: 'any tips for a beginner?' } as never, 'o@campus.test');
    expect(r.resources).toBeUndefined();               // nothing asked for, nothing shown
    script = async (run) => { await run('get_starter_resources', {}); return 'Here are some highlights.'; };
    const r2 = await make().chat({ message: 'any tips, books or websites?' } as never, 'o@campus.test');
    expect(r2.resources?.books.map((b) => b.title)).toContain('The Mom Test');
    expect(r2.resources?.websites.every((w) => w.url.startsWith('https://'))).toBe(true);
  });
  it('gives the model titles but no links', async () => {
    seenByModel.length = 0;
    script = async (run) => { await run('get_starter_resources', {}); return 'ok'; };
    await make().chat({ message: 'resources please' } as never, 'o@campus.test');
    expect(JSON.stringify(seenByModel[0])).toContain('The $100 Startup');
    expect(JSON.stringify(seenByModel[0])).not.toMatch(/https?:\/\//);
  });
});
