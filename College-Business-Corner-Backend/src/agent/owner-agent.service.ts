import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { BusinessesService } from '../businesses/businesses.service.js';
import { InterestsService } from '../insights/interests.service.js';
import type { AgentChatDto } from './agent.dto.js';
import { errorStatus, isNetworkError, runAgentLoop } from './agent.loop.js';
import { ownerInstruction } from './owner-agent.prompt.js';
import type { OwnedBusinessView, Proposal } from './owner-proposals.js';
import { createOwnerToolExecutor, OWNER_TOOLS } from './owner-tools.js';

const MAX_MESSAGE_CHARS = 1500;
const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 2000;

@Injectable()
export class OwnerAgentService {
  private readonly logger = new Logger(OwnerAgentService.name);
  private client?: GoogleGenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly businesses: BusinessesService,
    private readonly interests: InterestsService,
  ) {}

  private getClient(): GoogleGenAI {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('The business assistant is not configured: GEMINI_API_KEY is missing.');
    this.client ??= new GoogleGenAI({ apiKey });
    return this.client;
  }

  async chat(dto: AgentChatDto, ownerEmail: string) {
    const message = typeof dto?.message === 'string' ? dto.message.trim() : '';
    if (!message) throw new BadRequestException('message is required');
    if (message.length > MAX_MESSAGE_CHARS) throw new BadRequestException(`message must be at most ${MAX_MESSAGE_CHARS} characters`);

    const history = Array.isArray(dto.history) ? dto.history.slice(-MAX_HISTORY_TURNS) : [];
    const contents: any[] = history
      .filter((t) => (t?.role === 'user' || t?.role === 'model') && typeof t.text === 'string' && t.text.trim())
      .map((t) => ({ role: t.role, parts: [{ text: t.text.slice(0, MAX_HISTORY_CHARS) }] }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const proposals: Proposal[] = [];
    // The owner is fixed by the sign-in token, never by anything the model says.
    const execute = createOwnerToolExecutor(
      {
        getBusinesses: () => this.businesses.listForOwner(ownerEmail) as Promise<OwnedBusinessView[]>,
        getPaypalStatus: (id) => this.businesses.paypalStatus(id, ownerEmail),
        getDemandInsights: ({ days, limit }) => this.interests.insights(days, limit),
      },
      proposals,
    );

    try {
      const result = await runAgentLoop({
        client: this.getClient(),
        model: this.config.get<string>('GEMINI_MODEL') || 'gemini-3.5-flash',
        systemInstruction: ownerInstruction(new Date().toISOString().slice(0, 10)),
        tools: OWNER_TOOLS,
        contents,
        executeTool: async (name, args) => {
          try {
            return await execute(name, args);
          } catch (err) {
            this.logger.error(`Owner tool ${name} failed: ${(err as Error)?.message}`);
            throw err;
          }
        },
      });
      return {
        reply: result.reply,
        proposals,
        steps: result.steps.map((s) => ({ tool: s.tool, summary: summarise(s.tool, s.result) })),
      };
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) throw err;
      const status = errorStatus(err);
      this.logger.error(`Gemini error ${status ?? ''}: ${String(err?.message ?? err).slice(0, 300)}`);
      if (isNetworkError(err)) throw new ServiceUnavailableException("Could not reach Google's AI service. Check your internet connection and try again.");
      if (status === 429) throw new ServiceUnavailableException('The assistant hit its free-tier request limit. Please wait about a minute and try again.');
      if (status === 503) throw new ServiceUnavailableException('The AI service is overloaded right now. Please try again in a moment.');
      throw new BadGatewayException('The assistant could not be reached. Please try again.');
    }
  }
}

function summarise(tool: string, result: unknown): string {
  const r = result as any;
  if (tool === 'get_my_businesses' && Array.isArray(r)) return `${r.length} business(es) read`;
  if (tool === 'get_demand_insights') return `${r?.topSearches?.length ?? 0} popular searches read`;
  if (tool.startsWith('propose_')) return r?.accepted ? 'prepared for confirmation' : 'needs changes';
  return r?.error ? 'error' : 'ok';
}
