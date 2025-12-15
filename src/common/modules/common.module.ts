import { Module } from '@nestjs/common';
import { HealthController } from '../controllers/health.controller';
import { RootController } from '../controllers/root.controller';


@Module({
  controllers: [HealthController, RootController],
})
export class CommonModule {}
