import { runAgentLoop, type GeminiLike } from './agent.loop.js';

const fakeClient = (responses: any[]): GeminiLike & { calls: any[] } => {
  const calls: any[] = [];
  return {
    calls,
    models: {
      async generateContent(args: any) {
        calls.push(JSON.parse(JSON.stringify(args.contents)));
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    },
  };
};

const base = (client: GeminiLike, executeTool: any, extra: any = {}) => ({
  client,
  model: 'test-model',
  systemInstruction: 'sys',
  tools: [],
  contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
  executeTool,
  sleep: async () => {},
  ...extra,
});

describe('runAgentLoop', () => {
  it('runs tools then returns the final text', async () => {
    const client = fakeClient([
      { functionCalls: [{ id: 'c1', name: 'search_listings', args: { q: 'haircut' } }], candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'search_listings' } }] } }] },
      { functionCalls: undefined, text: 'Found one haircut for $15.' },
    ]);
    const executed: string[] = [];
    const out = await runAgentLoop(base(client, async (name: string) => { executed.push(name); return [{ id: 'x' }]; }));
    expect(out.reply).toBe('Found one haircut for $15.');
    expect(out.finished).toBe(true);
    expect(executed).toHaveLength(1);
    expect(out.steps).toHaveLength(1);
    // second request contains the model turn and the tool result
    expect(client.calls[1]).toHaveLength(3);
    expect(client.calls[1][2].parts[0].functionResponse.name).toBe('search_listings');
  });

  it('turns a failing tool into an error result instead of crashing', async () => {
    const client = fakeClient([
      { functionCalls: [{ name: 'request_checkout', args: {} }] },
      { text: 'Something went wrong.' },
    ]);
    const out = await runAgentLoop(base(client, async () => { throw new Error('boom'); }));
    expect(out.finished).toBe(true);
    expect((out.steps[0].result as any).error).toBeTruthy();
  });

  it('retries on 429 and then succeeds', async () => {
    const rate: any = new Error('rate'); rate.status = 429;
    const client = fakeClient([rate, { text: 'ok now' }]);
    const out = await runAgentLoop(base(client, async () => ({})));
    expect(out.reply).toBe('ok now');
  });

  it('gives up after repeated 429s', async () => {
    const rate: any = new Error('rate'); rate.status = 429;
    const client = fakeClient([rate, rate, rate, rate]);
    let threw = false;
    try { await runAgentLoop(base(client, async () => ({}))); } catch { threw = true; }
    expect(threw).toBe(true);
  });

  it('stops after maxSteps if the model keeps calling tools', async () => {
    const loop = Array.from({ length: 10 }, () => ({ functionCalls: [{ name: 'search_listings', args: { q: 'a' } }] }));
    const out = await runAgentLoop(base(fakeClient(loop), async () => [], { maxSteps: 3 }));
    expect(out.finished).toBe(false);
    expect(out.steps).toHaveLength(3);
  });
});
