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
import { AssignControllersDto } from './dto/assign-controllers.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';

@Controller('equipment')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}
  @Get()
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  list(
    @Req() req: { user: { sub: string } },
    @Query('organizationId') organizationId?: string,
    @Query('siteId') siteId?: string,
    @Query('type') type?: string,
    @Query('active') active?: string,
    @Query('search') search?: string,
  ) {
    return this.equipment.list(req.user.sub, {
      organizationId,
      siteId,
      type,
      active,
      search,
    });
  }
  @Post() @Roles(UserRole.ADMIN) create(@Body() dto: CreateEquipmentDto) {
    return this.equipment.create(dto);
  }
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
    @Query('preset') preset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('timezone') timezone?: string,
  ) {
    return this.equipment.detail(id, req.user.sub, {
      preset,
      from,
      to,
      timezone,
    });
  }
  @Get(':id/events')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  events(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('timezone') timezone?: string,
  ) {
    return this.equipment.events(
      id,
      req.user.sub,
      { from, to, timezone },
      Number(page || 1),
      Number(pageSize || 25),
    );
  }
  @Patch(':id') @Roles(UserRole.ADMIN) update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipment.update(id, dto);
  }
  @Post(':id/activate') @Roles(UserRole.ADMIN) activate(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.equipment.setActive(id, true);
  }
  @Post(':id/archive') @Roles(UserRole.ADMIN) archive(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.equipment.setActive(id, false);
  }
  @Post(':id/controllers') @Roles(UserRole.ADMIN) assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignControllersDto,
  ) {
    return this.equipment.assignControllers(id, dto);
  }
}
