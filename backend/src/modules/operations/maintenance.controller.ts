import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MaintenanceService } from './maintenance.service';
import { AlertsService } from './alerts.service';
import { Actor } from './operations.util';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class MaintenanceController {
  constructor(
    private readonly maintenance: MaintenanceService,
    private readonly alerts: AlertsService,
  ) {}
  @Get() list(
    @Req() req: { user: Actor },
    @Query() query: Record<string, unknown>,
  ) {
    return this.maintenance.list(req.user, query);
  }
  @Post('plans') @Roles(UserRole.ADMIN) plan(
    @Req() req: { user: Actor },
    @Body() body: Record<string, unknown>,
  ) {
    return this.maintenance.createPlan(req.user, body);
  }
  @Patch('plans/:id') @Roles(UserRole.ADMIN) update(
    @Req() req: { user: Actor },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.maintenance.updatePlan(req.user, id, body);
  }
  @Post('services') async service(
    @Req() req: { user: Actor },
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.maintenance.service(req.user, body);
    await this.alerts.refreshEquipment(String(body.equipmentId), 'SERVICE');
    return row;
  }
  @Post('services/:id/void') async voidService(
    @Req() req: { user: Actor },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.maintenance.voidService(
      req.user,
      id,
      body.reason,
    );
    await this.alerts.refreshEquipment(
      result.equipmentId,
      'SERVICE_CORRECTION',
    );
    return result.record;
  }
  @Post('services/:id/correct') async correctService(
    @Req() req: { user: Actor },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.maintenance.correctService(req.user, id, body);
    await this.alerts.refreshEquipment(
      result.equipmentId,
      'SERVICE_CORRECTION',
    );
    return result.record;
  }
}
