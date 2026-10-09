import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Device } from '../devices/device.entity';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { Organization } from '../organizations/organization.entity';
import { Site } from '../sites/site.entity';
import { User } from '../users/user.entity';
import { EquipmentController } from './equipment.controller';
import { Equipment } from './equipment.entity';
import { EquipmentService } from './equipment.service';
@Module({
  imports: [
    TypeOrmModule.forFeature([Equipment, Site, Organization, Device, User]),
    MonitoringModule,
    AuthModule,
  ],
  controllers: [EquipmentController],
  providers: [EquipmentService],
  exports: [EquipmentService, TypeOrmModule],
})
export class EquipmentModule {}
