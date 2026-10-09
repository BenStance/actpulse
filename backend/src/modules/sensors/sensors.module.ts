import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceApiKeyGuard } from '../../common/guards/device-api-key.guard';
import { Device } from '../devices/device.entity';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { SensorLog } from './sensor-log.entity';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([SensorLog, Device]),
    MonitoringModule,
    RealtimeModule,
  ],
  controllers: [SensorsController],
  providers: [SensorsService, DeviceApiKeyGuard],
  exports: [SensorsService, TypeOrmModule],
})
export class SensorsModule {}
