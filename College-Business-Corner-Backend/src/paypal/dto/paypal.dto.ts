import { ApiProperty } from '@nestjs/swagger';

export class OnboardSellerDto {
  @ApiProperty({
    example: 'business-123',
    description: 'YOUR own id for the business. PayPal echoes it back so you can match the seller.',
  })
  trackingId: string;
}

export class OrderItemDto {
  @ApiProperty({
    example: 'NR94ASH7KHULQ',
    description: "The seller's PayPal merchant ID (from onboarding).",
  })
  sellerMerchantId: string;

  @ApiProperty({ example: '10.00', description: 'Sale amount for this seller (USD, string).' })
  amount: string;

  @ApiProperty({
    example: '1.00',
    description: 'Platform fee taken from this sale (USD, string). Use "0.00" for none.',
  })
  platformFee: string;

  @ApiProperty({ example: 'Print 40 pages (A4, black & white)' })
  description: string;
}

export class CreateOrderDto {
  @ApiProperty({
    type: [OrderItemDto],
    description: 'One entry per seller. Each becomes one PayPal purchase unit.',
  })
  items: OrderItemDto[];
}
