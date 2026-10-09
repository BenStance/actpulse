import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OperationalReportsService } from './operational-reports.service';
import { Actor } from './operations.util';

@Controller('reports/operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class OperationalReportsController {
  constructor(private readonly reports: OperationalReportsService) {}
  @Get() report(
    @Req() req: { user: Actor },
    @Query() query: Record<string, unknown>,
  ) {
    return this.reports.report(req.user, query);
  }
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="actpulse-operations.csv"',
  )
  csv(@Req() req: { user: Actor }, @Query() query: Record<string, unknown>) {
    return this.reports.csv(req.user, query);
  }
}
