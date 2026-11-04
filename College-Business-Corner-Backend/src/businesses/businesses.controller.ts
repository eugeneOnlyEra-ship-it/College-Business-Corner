import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OwnerGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { CreateBusinessDto, CreateListingDto, ListingImageDto } from './businesses.dto.js';
import { BusinessesService } from './businesses.service.js';

/** Every route needs a business-owner session. The owner is taken from the token, never from the request body. */
@ApiTags('businesses')
@ApiBearerAuth()
@UseGuards(OwnerGuard)
@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businesses: BusinessesService) {}

  @Post()
  create(@Body() body: CreateBusinessDto, @Req() req: AuthedRequest) {
    return this.businesses.create({ ...body, ownerEmail: req.user.email });
  }

  @Get()
  mine(@Req() req: AuthedRequest) {
    return this.businesses.listForOwner(req.user.email);
  }

  @Post(':id/listings')
  addListing(@Param('id') id: string, @Body() body: CreateListingDto, @Req() req: AuthedRequest) {
    return this.businesses.addListing(id, { ...body, ownerEmail: req.user.email });
  }

  @Post(':id/listings/:listingId/image')
  setImage(@Param('id') id: string, @Param('listingId') listingId: string, @Body() body: ListingImageDto, @Req() req: AuthedRequest) {
    return this.businesses.setListingImage(id, listingId, { ...body, ownerEmail: req.user.email });
  }

  @Post(':id/paypal/connect')
  connect(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.businesses.connectPaypal(id, req.user.email);
  }

  @Get(':id/paypal/status')
  status(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.businesses.paypalStatus(id, req.user.email);
  }
}
