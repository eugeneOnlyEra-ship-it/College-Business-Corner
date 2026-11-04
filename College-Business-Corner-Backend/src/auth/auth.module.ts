import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard, OwnerGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, OwnerGuard],
  exports: [AuthService, AuthGuard, OwnerGuard],
})
export class AuthModule {}
