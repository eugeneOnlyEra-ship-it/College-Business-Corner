import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { ListingsService } from '../listings/listings.service.js';
import { OrdersService } from '../orders/orders.service.js';
import type { AgentChatDto } from './agent.dto.js';
import { runAgentLoop } from './agent.loop.js';
import { SYSTEM_INSTRUCTION } from './agent.prompt.js';
import { AGENT_TOOLS } from './agent.tools.js';

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 2000;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private client?: GoogleGenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly listings: ListingsService,
    private readonly orders: OrdersService,
  ) {}

  /** Created on first use, so the rest of the app still runs without a Gemini key. */
  private getClient(): GoogleGenAI {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('The shopping assistant is not configured: GEMINI_API_KEY is missing.');
    }
    this.client ??= new GoogleGenAI({ apiKey });
    return this.client;
  }

  async chat(dto: AgentChatDto) {
    const message = typeof dto?.message === 'string' ? dto.message.trim() : '';
    if (!message) throw new BadRequestException('message is required');
    if (message.length > MAX_MESSAGE_CHARS) {
      throw new BadRequestException(`message must be at most ${MAX_MESSAGE_CHARS} characters`);
    }

    const history = Array.isArray(dto.history) ? dto.history.slice(-MAX_HISTORY_TURNS) : [];
    const contents: any[] = history
      .filter((t) => (t?.role === 'user' || t?.role === 'model') && typeof t.text === 'string' && t.text.trim())
      .map((t) => ({ role: t.role, parts: [{ text: t.text.slice(0, MAX_HISTORY_CHARS) }] }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    let checkout: unknown = null;

    const executeTool = async (name: string, args: any): Promise<unknown> => {
      if (name === 'search_listings') {
        const q = typeof args?.q === 'string' ? args.q : '';
        const max = Number.isFinite(args?.maxPriceCents) ? Math.round(args.maxPriceCents) : undefined;
        const found = await this.listings.search({ q, maxPriceCents: max });
        return found.slice(0, 8).map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description.slice(0, 120),
          kind: l.kind,
          priceCents: l.priceCents,
          unit: l.unit,
          business: l.business.name,
          category: l.business.category,
          canReceivePayments: l.business.canReceivePayments,
        }));
      }

      if (name === 'request_checkout') {
        // Built explicitly: the model can never set `confirmed` or pick the buyer.
        const items = Array.isArray(args?.items)
          ? args.items.map((i: any) => ({ listingId: i?.listingId, quantity: i?.quantity }))
          : [];
        const budgetCents = Number.isFinite(args?.budgetCents) ? Math.round(args.budgetCents) : undefined;
        const request = { items, budgetCents };
        try {
          const result = await this.orders.createOrder({ items, budgetCents }, 'agent');
          checkout = { ...result, request };
          return result;
        } catch (err) {
          if (err instanceof UnprocessableEntityException) {
            const blocked = err.getResponse() as Record<string, unknown>;
            checkout = { ...blocked, request };
            return blocked;
          }
          throw err;
        }
      }

      return { error: `Unknown tool: ${name}` };
    };

    try {
      const result = await runAgentLoop({
        client: this.getClient(),
        model: this.config.get<string>('GEMINI_MODEL') || 'gemini-3.5-flash',
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: AGENT_TOOLS,
        contents,
        executeTool: async (name, args) => {
          try {
            return await executeTool(name, args);
          } catch (err) {
            this.logger.error(`Tool ${name} failed: ${(err as Error)?.message}`);
            throw err;
          }
        },
      });
      return {
        reply: result.reply,
        checkout,
        steps: result.steps.map((s) => ({
          tool: s.tool,
          args: s.args,
          summary: summarise(s.tool, s.result),
        })),
      };
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      const status = err?.status ?? err?.code;
      this.logger.error(`Gemini error ${status ?? ''}: ${String(err?.message ?? err).slice(0, 300)}`);
      if (status === 429) {
        throw new ServiceUnavailableException('The assistant hit its free-tier request limit. Please wait about a minute and try again.');
      }
      if (status === 503) {
        throw new ServiceUnavailableException('The AI service is overloaded right now. Please try again in a moment.');
      }
      throw new BadGatewayException('The assistant could not be reached. Please try again.');
    }
  }
}

function summarise(tool: string, result: unknown): string {
  const r = result as any;
  if (tool === 'search_listings' && Array.isArray(r)) return `${r.length} listing(s) found`;
  if (tool === 'request_checkout' && r?.decision) return `decision: ${r.decision}`;
  return r?.error ? 'error' : 'ok';
}
