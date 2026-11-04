import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { InsightsController } from './insights.controller.js';
import { InterestsService } from './interests.service.js';

@Module({
  imports: [AuthModule],
  controllers: [InsightsController],
  providers: [InterestsService],
  exports: [InterestsService],
})
export class InsightsModule {}
