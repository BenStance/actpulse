import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';

@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  create(@Body() dto: CreateDeviceDto) {
    return this.devicesService.create(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER, UserRole.USER)
  findAll(@Req() req: { user: { sub: string } }) {
    return this.devicesService.findAll(req.user.sub);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER, UserRole.USER)
  findOne(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.devicesService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto, @Req() req: { user: { sub: string } }) {
    return this.devicesService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  deactivate(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.devicesService.deactivate(id, req.user.sub);
  }

  @Post(':id/rotate-key')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  rotateKey(@Param('id') id: string, @Req() req: { user: { sub: string } }) {
    return this.devicesService.rotateKey(id, req.user.sub);
  }
}
