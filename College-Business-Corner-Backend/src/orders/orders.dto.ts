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

  @ApiPropertyOptional({ example: 2500, description: 'Budget the buyer stated, in cents.' })
  budgetCents?: number;

  @ApiPropertyOptional({ example: 2500, description: 'Total quoted earlier, in cents. A different total makes the policy engine ask.' })
  quotedTotalCents?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Set true ONLY after the buyer approved a policy "ASK". Cannot override a BLOCK.',
  })
  confirmed?: boolean;
}
