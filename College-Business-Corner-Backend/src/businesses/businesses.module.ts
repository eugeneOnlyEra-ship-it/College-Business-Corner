import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PaypalModule } from '../paypal/paypal.module.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';

@Module({
  imports: [AuthModule, PaypalModule],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
