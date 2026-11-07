import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { ListingsService } from './listings.service.js';

@ApiTags('listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiQuery({ name: 'q', required: false, description: 'Search text, e.g. "haircut" or "printing"' })
  @ApiQuery({ name: 'maxPriceCents', required: false, description: 'Maximum price in cents (1500 = $15.00)' })
  search(@Query('q') q?: string, @Query('maxPriceCents') maxPriceCents?: string) {
    const max = maxPriceCents !== undefined ? Number.parseInt(maxPriceCents, 10) : undefined;
    return this.listings.search({ q, maxPriceCents: Number.isNaN(max) ? undefined : max });
  }

  /** One business with all of its active listings (public, read-only). */
  @Get('businesses/:id')
  business(@Param('id') id: string) {
    return this.listings.businessProfile(id);
  }
}
