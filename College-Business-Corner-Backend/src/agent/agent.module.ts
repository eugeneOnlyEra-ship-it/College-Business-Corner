import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';

@Module({
  imports: [ListingsModule, OrdersModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
