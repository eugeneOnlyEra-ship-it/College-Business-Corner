import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
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

  // The signed-in buyer's own audit trail: every allow / ask / block decision about their orders, newest first.
  // Owners get an empty list: their sales are under /businesses/:id/sales, and buyers' carts are not theirs to see.
  @Get('audit')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiQuery({ name: 'orderId', required: false })
  audit(@Req() req: AuthedRequest, @Query('orderId') orderId?: string) {
    if (req.user.role !== 'BUYER') return [];
    return this.policy.recentAudit(req.user.email, orderId);
  }
}
