import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TokenBlacklist } from '../auth/token-blacklist.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';
import { Device } from './device.entity';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, User, TokenBlacklist, SensorLog])],
  controllers: [DevicesController],
  providers: [DevicesService, JwtAuthGuard, RolesGuard],
  exports: [DevicesService, TypeOrmModule],
})
export class DevicesModule {}
