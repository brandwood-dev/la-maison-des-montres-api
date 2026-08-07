import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { SettingsModule } from '../settings/settings.module';
import { TeamModule } from '../team/team.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [EmailModule, SettingsModule, TeamModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
