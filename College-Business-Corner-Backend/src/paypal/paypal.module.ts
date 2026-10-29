import { Module } from '@nestjs/common';
import { PaypalController } from './paypal.controller.js';
import { PaypalService } from './paypal.service.js';

@Module({
  controllers: [PaypalController],
  providers: [PaypalService],
  exports: [PaypalService],
})
export class PaypalModule {}
