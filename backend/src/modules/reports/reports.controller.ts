import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReportsService } from './reports.service';
import type { ReportFilters } from './reports.service';
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}
  @Get('equipment') equipment(
    @Req() req: { user: { sub: string } },
    @Query() filters: ReportFilters,
  ) {
    return this.reports.equipmentReport(req.user.sub, filters);
  }
  @Get('equipment-events') events(
    @Req() req: { user: { sub: string } },
    @Query() filters: ReportFilters,
  ) {
    return this.reports.events(req.user.sub, filters);
  }
  @Get('fleet-summary') fleet(
    @Req() req: { user: { sub: string } },
    @Query() filters: ReportFilters,
  ) {
    return this.reports.fleet(req.user.sub, filters);
  }
  @Get('fleet.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="actpulse-equipment-report.csv"',
  )
  csv(@Req() req: { user: { sub: string } }, @Query() filters: ReportFilters) {
    return this.reports.csv(req.user.sub, filters);
  }
  @Get('device-uptime') legacyUptime(
    @Req() req: { user: { sub: string } },
    @Query() filters: ReportFilters,
  ) {
    return this.reports.equipmentReport(req.user.sub, filters);
  }
  @Get('device-daily') async legacyDaily(
    @Req() req: { user: { sub: string } },
    @Query() filters: ReportFilters,
  ) {
    return (await this.reports.equipmentReport(req.user.sub, filters)).daily;
  }
  @Get('device-events') legacyEvents(
    @Req() req: { user: { sub: string } },
    @Query() filters: ReportFilters,
  ) {
    return this.reports.events(req.user.sub, filters);
  }
}
