import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OwnerGuard } from '../auth/auth.guard.js';
import { InterestsService } from './interests.service.js';

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(OwnerGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly interests: InterestsService) {}

  /** What students are searching for, anonymously, so a new owner can see where the demand is. */
  @Get('demand')
  @ApiQuery({ name: 'days', required: false, description: 'Look back this many days (1 to 180, default 30)' })
  @ApiQuery({ name: 'limit', required: false, description: 'How many keywords (1 to 20, default 10)' })
  demand(@Query('days') days?: string, @Query('limit') limit?: string) {
    return this.interests.insights(Number.parseInt(days ?? '', 10) || undefined, Number.parseInt(limit ?? '', 10) || undefined);
  }
}
