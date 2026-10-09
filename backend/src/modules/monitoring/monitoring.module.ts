import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../devices/device.entity';
import { DeviceBinding } from '../devices/device-binding.entity';
import { Equipment } from '../equipment/equipment.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';
import { ConnectivityEvent } from './connectivity-event.entity';
import { ConnectivityService } from './connectivity.service';
import { RealtimeModule } from '../realtime/realtime.module';
import {
  EquipmentAccessService,
  MonitoringService,
} from './monitoring.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Device,
      DeviceBinding,
      Equipment,
      SensorLog,
      User,
      ConnectivityEvent,
    ]),
    RealtimeModule,
  ],
  providers: [EquipmentAccessService, MonitoringService, ConnectivityService],
  exports: [
    EquipmentAccessService,
    MonitoringService,
    ConnectivityService,
    TypeOrmModule,
  ],
})
export class MonitoringModule {}
