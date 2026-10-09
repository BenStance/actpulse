import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import type { DashboardFilters } from './dashboard.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly adminDashboard: AdminDashboardService,
  ) {}
  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  admin(
    @Req() req: { user: { sub: string } },
    @Query()
    filters: DashboardFilters & {
      currency?: string;
      orgPage?: string;
      equipmentPage?: string;
      pageSize?: string;
    },
  ) {
    return this.adminDashboard.overview(req.user.sub, filters);
  }
  @Get('overview') overview(
    @Req() req: { user: { sub: string } },
    @Query() filters: DashboardFilters,
  ) {
    return this.dashboard.overview(req.user.sub, filters);
  }
  @Get('summary') async summary(
    @Req() req: { user: { sub: string } },
    @Query() filters: DashboardFilters,
  ) {
    return (await this.dashboard.overview(req.user.sub, filters)).summary;
  }
  @Get('uptime') async uptime(
    @Req() req: { user: { sub: string } },
    @Query() filters: DashboardFilters,
  ) {
    return (await this.dashboard.overview(req.user.sub, filters)).daily;
  }
  @Get('downtime') async downtime(
    @Req() req: { user: { sub: string } },
    @Query() filters: DashboardFilters,
  ) {
    return (await this.dashboard.overview(req.user.sub, filters)).daily;
  }
  @Get('activity') async activity(
    @Req() req: { user: { sub: string } },
    @Query() filters: DashboardFilters,
  ) {
    return (await this.dashboard.overview(req.user.sub, filters)).activity;
  }
}
