import { Module } from '@nestjs/common';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { OperationsModule } from '../operations/operations.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AdminDashboardService } from './admin-dashboard.service';
@Module({
  imports: [MonitoringModule, OperationsModule],
  controllers: [DashboardController],
  providers: [DashboardService, AdminDashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
