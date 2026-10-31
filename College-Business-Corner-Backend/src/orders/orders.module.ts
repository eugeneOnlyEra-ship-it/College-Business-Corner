import { Module } from '@nestjs/common';
import { PaypalModule } from '../paypal/paypal.module.js';
import { PolicyModule } from '../policy/policy.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [PaypalModule, PolicyModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
