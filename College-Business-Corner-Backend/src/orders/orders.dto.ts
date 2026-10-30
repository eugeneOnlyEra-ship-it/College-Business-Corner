import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderLineDto {
  @ApiProperty({ example: 'clxyz123', description: 'Listing id from GET /listings' })
  listingId: string;

  @ApiProperty({ example: 1, description: 'Whole number, 1-20' })
  quantity: number;
}

export class CreateStoreOrderDto {
  @ApiProperty({ type: [OrderLineDto] })
  items: OrderLineDto[];

  @ApiPropertyOptional({
    example: 'student@example.com',
    description: 'Buyer. Defaults to the seeded demo student until sign-in exists.',
  })
  buyerEmail?: string;
}
