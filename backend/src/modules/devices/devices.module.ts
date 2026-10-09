import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './device.entity';
import { DeviceBinding } from './device-binding.entity';
import { DeviceKeyAudit } from './device-key-audit.entity';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { Equipment } from '../equipment/equipment.entity';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Device,
      DeviceBinding,
      DeviceKeyAudit,
      Equipment,
      Organization,
      User,
    ]),
    MonitoringModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService, TypeOrmModule],
})
export class DevicesModule {}
