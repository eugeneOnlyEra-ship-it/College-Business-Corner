/**
 * The agent loop, with no Nest or database imports so it can be tested with a fake client.
 *
 * Each round: send the conversation to the model. If it asks for tools, run them and send
 * the results back. When it answers in plain text, that is the reply.
 */

export interface GeminiLike {
  models: { generateContent(args: any): Promise<any> };
}

export interface AgentStep {
  tool: string;
  args: unknown;
  result: unknown;
}

export interface AgentLoopOptions {
  client: GeminiLike;
  model: string;
  systemInstruction: string;
  tools: unknown[];
  contents: any[];
  executeTool: (name: string, args: any) => Promise<unknown>;
  maxSteps?: number;
  /** Injectable so tests do not wait. */
  sleep?: (ms: number) => Promise<void>;
}

export interface AgentLoopResult {
  reply: string;
  steps: AgentStep[];
  finished: boolean;
}

// Free-tier limits reset over about a minute, so short retries do not help.
const RETRY_DELAYS_MS = [4000, 12000, 25000];
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function generateWithRetry(opts: AgentLoopOptions) {
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await opts.client.models.generateContent({
        model: opts.model,
        contents: opts.contents,
        config: {
          systemInstruction: opts.systemInstruction,
          tools: opts.tools,
          temperature: 0.2,
        },
      });
    } catch (err: any) {
      const status = err?.status ?? err?.code;
      const retryable = status === 429 || status === 503;
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw err;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<AgentLoopResult> {
  const maxSteps = opts.maxSteps ?? 6;
  const steps: AgentStep[] = [];

  for (let round = 0; round < maxSteps; round++) {
    const response = await generateWithRetry(opts);
    const calls: any[] = response.functionCalls ?? [];

    if (calls.length === 0) {
      const text = String(response.text ?? '').trim();
      return {
        reply: text || "Sorry, I couldn't put an answer together. Please try rephrasing your request.",
        steps,
        finished: true,
      };
    }

    // Keep the model's own turn exactly as returned (it may carry hidden reasoning signatures).
    const modelContent =
      response.candidates?.[0]?.content ??
      ({ role: 'model', parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args, id: c.id } })) } as any);
    opts.contents.push(modelContent);

    const parts: any[] = [];
    for (const call of calls) {
      let result: unknown;
      try {
        result = await opts.executeTool(call.name, call.args ?? {});
      } catch {
        result = { error: 'That tool failed. Do not retry it; tell the student something went wrong.' };
      }
      steps.push({ tool: call.name, args: call.args ?? {}, result });
      parts.push({
        functionResponse: {
          ...(call.id ? { id: call.id } : {}),
          name: call.name,
          response: { result },
        },
      });
    }
    opts.contents.push({ role: 'user', parts });
  }

  return {
    reply: "I couldn't finish that in a reasonable number of steps. Please try a simpler request.",
    steps,
    finished: false,
  };
}
