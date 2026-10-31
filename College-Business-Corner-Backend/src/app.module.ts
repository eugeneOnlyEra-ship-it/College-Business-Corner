import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentModule } from './agent/agent.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaypalModule } from './paypal/paypal.module.js';
import { PolicyModule } from './policy/policy.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, PaypalModule, ListingsModule, PolicyModule, OrdersModule, AgentModule],
})
export class AppModule {}
