import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { FuelController } from './fuel.controller';
import { FuelService } from './fuel.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { OperationalDashboardService } from './operational-dashboard.service';
import { OperationalReportsController } from './operational-reports.controller';
import { OperationalReportsService } from './operational-reports.service';
import {
  FuelTank,
  FuelReading,
  FuelRefill,
  FuelAdjustment,
  FuelEstimate,
  FuelReconciliation,
  MaintenancePlan,
  ServiceRecord,
  AlertRule,
  Alert,
  Notification,
  NotificationPreference,
  OperationalAudit,
} from './operational.entity';

@Module({
  imports: [
    MonitoringModule,
    RealtimeModule,
    TypeOrmModule.forFeature([
      FuelTank,
      FuelReading,
      FuelRefill,
      FuelAdjustment,
      FuelEstimate,
      FuelReconciliation,
      MaintenancePlan,
      ServiceRecord,
      AlertRule,
      Alert,
      Notification,
      NotificationPreference,
      OperationalAudit,
    ]),
  ],
  controllers: [
    FuelController,
    MaintenanceController,
    AlertsController,
    OperationalReportsController,
  ],
  providers: [
    FuelService,
    MaintenanceService,
    AlertsService,
    OperationalDashboardService,
    OperationalReportsService,
  ],
  exports: [
    FuelService,
    MaintenanceService,
    AlertsService,
    OperationalDashboardService,
    OperationalReportsService,
  ],
})
export class OperationsModule {}
