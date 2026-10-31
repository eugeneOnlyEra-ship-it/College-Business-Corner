import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderLineDto } from '../orders/orders.dto.js';

export class PolicyCheckDto {
  @ApiProperty({ type: [OrderLineDto] })
  items: OrderLineDto[];

  @ApiPropertyOptional({ example: 2500, description: 'Budget the buyer stated, in cents.' })
  budgetCents?: number;

  @ApiPropertyOptional({ example: 2500, description: 'Total quoted earlier, in cents.' })
  quotedTotalCents?: number;

  @ApiPropertyOptional({ enum: ['buyer', 'agent'], description: 'Who is asking (recorded in the audit log).' })
  actor?: 'buyer' | 'agent';
}
