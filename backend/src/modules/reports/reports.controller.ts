import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('device-uptime')
  deviceUptime(
    @Req() req: { user: { sub: string } },
    @Query('deviceId') deviceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getDeviceUptime(req.user.sub, deviceId, from, to);
  }

  @Get('device-daily')
  deviceDaily(
    @Req() req: { user: { sub: string } },
    @Query('deviceId') deviceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getDeviceDaily(req.user.sub, deviceId, from, to);
  }

  @Get('device-events')
  deviceEvents(
    @Req() req: { user: { sub: string } },
    @Query('deviceId') deviceId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getDeviceEvents(req.user.sub, deviceId, from, to);
  }

  @Get('fleet-summary')
  fleetSummary(
    @Req() req: { user: { sub: string } },
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getFleetSummary(req.user.sub, from, to);
  }
}
