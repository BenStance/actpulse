import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TokenBlacklist } from '../auth/token-blacklist.entity';
import { Device } from '../devices/device.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Device, SensorLog, TokenBlacklist])],
  controllers: [DashboardController],
  providers: [DashboardService, JwtAuthGuard],
  exports: [DashboardService],
})
export class DashboardModule {}
