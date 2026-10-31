import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { PolicyCheckDto } from './policy.dto.js';
import { PolicyService } from './policy.service.js';

@ApiTags('policy')
@Controller('policy')
export class PolicyController {
  constructor(private readonly policy: PolicyService) {}

  // Dry run: shows what the policy engine would decide. No order and no PayPal call.
  @Post('check')
  async check(@Body() body: PolicyCheckDto) {
    const r = await this.policy.evaluate({
      items: body.items,
      budgetCents: body.budgetCents,
      quotedTotalCents: body.quotedTotalCents,
      actor: body.actor,
      action: 'checkout.check',
    });
    return {
      decision: r.decision,
      reasons: r.reasons,
      totalCents: r.cart?.totalCents ?? null,
      platformFeeCents: r.cart?.platformFeeCents ?? null,
      auditId: r.auditId,
    };
  }

  // The audit trail: every allow / ask / block decision, newest first.
  @Get('audit')
  @ApiQuery({ name: 'orderId', required: false })
  audit(@Query('orderId') orderId?: string) {
    return this.policy.recentAudit(orderId);
  }
}
