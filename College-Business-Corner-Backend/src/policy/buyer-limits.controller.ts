import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { PolicyService } from './policy.service.js';

/** A signed-in buyer's own spending limits. They can only make the safety rules stricter. */
@ApiTags('policy')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('buyers/me')
export class BuyerLimitsController {
  constructor(private readonly policy: PolicyService) {}

  @Get('limits')
  get(@Req() req: AuthedRequest) {
    return this.policy.getLimits(req.user.email);
  }

  /** Body: { maxOrderCents: number | null, confirmAboveCents: number | null }. null means "use the default". */
  @Put('limits')
  set(@Body() body: { maxOrderCents?: number | null; confirmAboveCents?: number | null }, @Req() req: AuthedRequest) {
    return this.policy.setLimits(req.user.email, body ?? {});
  }
}
