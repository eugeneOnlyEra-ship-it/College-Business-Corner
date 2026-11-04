import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OwnerGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { AgentChatDto } from './agent.dto.js';
import { AgentService } from './agent.service.js';
import { OwnerAgentService } from './owner-agent.service.js';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly ownerAgent: OwnerAgentService,
  ) {}

  // The shopping agent: plain-language request in, cart + checkout decision out.
  // It can propose a checkout but never pay: the policy engine decides, the buyer approves in PayPal.
  @Post('chat')
  chat(@Body() body: AgentChatDto) {
    return this.agent.chat(body);
  }

  // The business agent: helps an owner set up a business and listings and get connected to PayPal.
  // It can only PROPOSE; the owner confirms each proposal in the app. Needs an owner sign-in.
  @Post('owner/chat')
  @ApiBearerAuth()
  @UseGuards(OwnerGuard)
  ownerChat(@Body() body: AgentChatDto, @Req() req: AuthedRequest) {
    return this.ownerAgent.chat(body, req.user.email);
  }
}
