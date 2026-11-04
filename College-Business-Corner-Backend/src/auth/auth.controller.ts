import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthedRequest } from './auth.guard.js';
import { AuthService } from './auth.service.js';

export class LoginDto {
  @ApiProperty({ example: 'amina@example.com' })
  email: string;

  @ApiProperty({ enum: ['OWNER', 'BUYER'], description: 'OWNER sells on the marketplace, BUYER shops with the assistant.' })
  role: 'OWNER' | 'BUYER';

  @ApiPropertyOptional({ example: 'Amina' })
  name?: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Demo sign-in (no password). Copy the token into Swagger's Authorize button to try owner endpoints. */
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body?.email, body?.role, body?.name);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  me(@Req() req: AuthedRequest) {
    const { uid, email, role } = req.user;
    return { id: uid, email, role };
  }
}
