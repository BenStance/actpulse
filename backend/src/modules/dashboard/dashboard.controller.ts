import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  summary(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.getSummary(req.user.sub);
  }

  @Get('uptime')
  uptime(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.getUptime(req.user.sub);
  }

  @Get('downtime')
  downtime(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.getDowntime(req.user.sub);
  }

  @Get('activity')
  activity(@Req() req: { user: { sub: string } }) {
    return this.dashboardService.getActivity(req.user.sub);
  }
}
