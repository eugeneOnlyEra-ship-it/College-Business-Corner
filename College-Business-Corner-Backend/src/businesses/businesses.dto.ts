import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OwnerDto {
  /** Ignored: the owner now comes from the sign-in token. Kept so internal calls stay typed. */
  ownerEmail?: string;
}

export class CreateBusinessDto extends OwnerDto {
  @ApiPropertyOptional({ example: 'Amina' })
  ownerName?: string;

  @ApiProperty({ example: 'Laptop Fix Corner' })
  name: string;

  @ApiProperty({ example: 'repairs', description: 'e.g. printing, salon, groceries, transport, repairs' })
  category: string;

  @ApiPropertyOptional({ example: 'Screen and battery repairs near the hostels.' })
  description?: string;
}

export class CreateListingDto extends OwnerDto {
  @ApiProperty({ example: 'Screen repair' })
  title: string;

  @ApiPropertyOptional({ example: 'Most laptop models, same day.' })
  description?: string;

  @ApiPropertyOptional({ enum: ['PRODUCT', 'SERVICE'], default: 'SERVICE' })
  kind?: 'PRODUCT' | 'SERVICE';

  @ApiProperty({ example: 4500, description: 'Price in cents (4500 = $45.00). From 50 to 10000.' })
  priceCents: number;

  @ApiPropertyOptional({ example: 'per repair' })
  unit?: string;
}

export class ListingImageDto extends OwnerDto {
  @ApiProperty({ description: 'The photo as base64 or a data URL. JPEG, PNG or WebP, up to 1 MB.' })
  data: string;
}

export class UpdateBusinessDto extends OwnerDto {
  @ApiPropertyOptional({ example: 'Laptop Fix Corner' }) name?: string;
  @ApiPropertyOptional({ example: 'repairs' }) category?: string;
  @ApiPropertyOptional({ example: 'Screen and battery repairs near the hostels.' }) description?: string;
}

export class UpdateListingDto extends OwnerDto {
  @ApiPropertyOptional({ example: 'Screen repair' }) title?: string;
  @ApiPropertyOptional({ example: 'Most laptop models, same day.' }) description?: string;
  @ApiPropertyOptional({ enum: ['PRODUCT', 'SERVICE'] }) kind?: 'PRODUCT' | 'SERVICE';
  @ApiPropertyOptional({ example: 4500, description: 'Price in cents. From 50 to 10000.' }) priceCents?: number;
  @ApiPropertyOptional({ example: 'per repair' }) unit?: string;
  @ApiPropertyOptional({ description: 'false hides the listing from search and checkout; true shows it again.' }) active?: boolean;
}
