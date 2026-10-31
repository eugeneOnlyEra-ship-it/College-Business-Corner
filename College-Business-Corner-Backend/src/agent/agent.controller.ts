import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AgentChatDto } from './agent.dto.js';
import { AgentService } from './agent.service.js';

@ApiTags('agent')
@Controller('agent')
export class AgentController {
  constructor(private readonly agent: AgentService) {}

  // The shopping agent: plain-language request in, cart + checkout decision out.
  // It can propose a checkout but never pay: the policy engine decides, the buyer approves in PayPal.
  @Post('chat')
  chat(@Body() body: AgentChatDto) {
    return this.agent.chat(body);
  }
}
