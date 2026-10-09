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
import { AlertsService } from './alerts.service';
import { Actor } from './operations.util';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.CONTROLLER)
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}
  @Get('alerts') list(
    @Req() req: { user: Actor },
    @Query() query: Record<string, unknown>,
  ) {
    return this.alerts.list(req.user, query);
  }
  @Get('alerts/rules') rules(
    @Req() req: { user: Actor },
    @Query() query: Record<string, unknown>,
  ) {
    return this.alerts.rules(req.user, query);
  }
  @Post('alerts/rules') @Roles(UserRole.ADMIN) create(
    @Req() req: { user: Actor },
    @Body() body: Record<string, unknown>,
  ) {
    return this.alerts.saveRule(req.user, body);
  }
  @Patch('alerts/rules/:id') @Roles(UserRole.ADMIN) update(
    @Req() req: { user: Actor },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.alerts.saveRule(req.user, body, id);
  }
  @Post('alerts/:id/acknowledge') acknowledge(
    @Req() req: { user: Actor },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.alerts.acknowledge(req.user, id, body.note);
  }
  @Get('notifications') notifications(
    @Req() req: { user: Actor },
    @Query() query: Record<string, unknown>,
  ) {
    return this.alerts.notifications(req.user, query);
  }
  @Post('notifications/read-all') readAll(@Req() req: { user: Actor }) {
    return this.alerts.read(req.user);
  }
  @Post('notifications/:id/read') read(
    @Req() req: { user: Actor },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.alerts.read(req.user, id);
  }
  @Get('notifications/preferences') preferences(@Req() req: { user: Actor }) {
    return this.alerts.preferences(req.user);
  }
  @Patch('notifications/preferences') updatePreferences(
    @Req() req: { user: Actor },
    @Body() body: Record<string, unknown>,
  ) {
    return this.alerts.preferences(req.user, body);
  }
}
