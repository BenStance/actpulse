import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TokenBlacklist } from '../auth/token-blacklist.entity';
import { Device } from '../devices/device.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Device, SensorLog, TokenBlacklist])],
  controllers: [ReportsController],
  providers: [ReportsService, JwtAuthGuard, RolesGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
