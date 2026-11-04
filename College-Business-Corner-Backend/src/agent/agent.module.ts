import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { InsightsModule } from '../insights/insights.module.js';
import { ListingsModule } from '../listings/listings.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AgentController } from './agent.controller.js';
import { AgentService } from './agent.service.js';
import { OwnerAgentService } from './owner-agent.service.js';

@Module({
  imports: [AuthModule, BusinessesModule, InsightsModule, ListingsModule, OrdersModule],
  controllers: [AgentController],
  providers: [AgentService, OwnerAgentService],
})
export class AgentModule {}
