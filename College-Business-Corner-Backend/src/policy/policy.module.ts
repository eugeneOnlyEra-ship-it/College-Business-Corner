import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BuyerLimitsController } from './buyer-limits.controller.js';
import { PolicyController } from './policy.controller.js';
import { PolicyService } from './policy.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PolicyController, BuyerLimitsController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
