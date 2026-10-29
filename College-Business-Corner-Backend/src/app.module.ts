import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaypalModule } from './paypal/paypal.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PaypalModule],
})
export class AppModule {}
