import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../devices/device.entity';
import { DeviceBinding } from '../devices/device-binding.entity';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Device, DeviceBinding]),
    MonitoringModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
