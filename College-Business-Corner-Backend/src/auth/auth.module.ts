import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard, OptionalAuthGuard, OwnerGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, OwnerGuard, OptionalAuthGuard],
  exports: [AuthService, AuthGuard, OwnerGuard, OptionalAuthGuard],
})
export class AuthModule {}
