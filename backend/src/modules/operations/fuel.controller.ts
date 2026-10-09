import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Actor } from './operations.util';
import { FuelService } from './fuel.service';
import { AlertsService } from './alerts.service';

@Controller('fuel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class FuelController {
  constructor(
    private readonly fuel: FuelService,
    private readonly alerts: AlertsService,
  ) {}
  @Get(':equipmentId') overview(
    @Req() req: { user: Actor },
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.fuel.overview(req.user, equipmentId, query);
  }
  @Post(':equipmentId/tank') @Roles(UserRole.ADMIN) tank(
    @Req() req: { user: Actor },
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.fuel.configureTank(req.user, equipmentId, body);
  }
  @Post(':equipmentId/readings') async reading(
    @Req() req: { user: Actor },
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.fuel.addReading(req.user, equipmentId, body);
    await this.alerts.refreshEquipment(equipmentId, 'FUEL_READING');
    return row;
  }
  @Post(':equipmentId/refills') async refill(
    @Req() req: { user: Actor },
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.fuel.addRefill(req.user, equipmentId, body);
    await this.alerts.refreshEquipment(equipmentId, 'REFILL');
    return row;
  }
  @Post(':equipmentId/adjustments') async adjustment(
    @Req() req: { user: Actor },
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.fuel.addAdjustment(req.user, equipmentId, body);
    await this.alerts.refreshEquipment(equipmentId, 'FUEL_ADJUSTMENT');
    return row;
  }
  @Post(':equipmentId/estimates') @Roles(UserRole.ADMIN) estimate(
    @Req() req: { user: Actor },
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.fuel.addRate(req.user, equipmentId, body);
  }
  @Post(':equipmentId/reconciliations') async reconcile(
    @Req() req: { user: Actor },
    @Param('equipmentId', ParseUUIDPipe) equipmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const row = await this.fuel.reconcile(req.user, equipmentId, body);
    await this.alerts.refreshEquipment(equipmentId, 'RECONCILIATION');
    return row;
  }
  @Post('reconciliations/:id/finalize') @Roles(UserRole.ADMIN) finalize(
    @Req() req: { user: Actor },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.fuel.finalize(req.user, id, body.note);
  }
  @Post(':kind/:id/void') async voidRecord(
    @Req() req: { user: Actor },
    @Param('kind') kind: 'readings' | 'refills' | 'adjustments',
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.fuel.voidRecord(req.user, kind, id, body.reason);
    await this.alerts.refreshEquipment(result.equipmentId, 'FUEL_CORRECTION');
    return result.record;
  }
  @Post(':kind/:id/correct') async correctRecord(
    @Req() req: { user: Actor },
    @Param('kind') kind: 'readings' | 'refills' | 'adjustments',
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = await this.fuel.correctRecord(req.user, kind, id, body);
    await this.alerts.refreshEquipment(result.equipmentId, 'FUEL_CORRECTION');
    return result.record;
  }
}
