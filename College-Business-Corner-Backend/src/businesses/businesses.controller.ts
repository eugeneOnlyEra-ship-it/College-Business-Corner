import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OwnerGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { CreateBusinessDto, CreateListingDto, ListingImageDto, UpdateBusinessDto, UpdateListingDto } from './businesses.dto.js';
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

  /** Close the business: hidden from shoppers and closed to new orders. History is kept. */
  @Post(':id/close')
  close(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.businesses.close(id, req.user.email);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.businesses.reopen(id, req.user.email);
  }

  /** Delete for good. Only allowed when nothing was ever ordered from the business. */
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.businesses.remove(id, req.user.email);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateBusinessDto, @Req() req: AuthedRequest) {
    return this.businesses.updateBusiness(id, { ...body, ownerEmail: req.user.email });
  }

  @Patch(':id/listings/:listingId')
  updateListing(@Param('id') id: string, @Param('listingId') listingId: string, @Body() body: UpdateListingDto, @Req() req: AuthedRequest) {
    return this.businesses.updateListing(id, listingId, { ...body, ownerEmail: req.user.email });
  }

  @Post(':id/listings')
  addListing(@Param('id') id: string, @Body() body: CreateListingDto, @Req() req: AuthedRequest) {
    return this.businesses.addListing(id, { ...body, ownerEmail: req.user.email });
  }

  @Post(':id/listings/:listingId/image')
  setImage(@Param('id') id: string, @Param('listingId') listingId: string, @Body() body: ListingImageDto, @Req() req: AuthedRequest) {
    return this.businesses.setListingImage(id, listingId, { ...body, ownerEmail: req.user.email });
  }

  @Get(':id/sales')
  sales(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.businesses.sales(id, req.user.email);
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
