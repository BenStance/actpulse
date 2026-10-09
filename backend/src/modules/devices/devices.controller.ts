import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DeviceLifecycle } from './device.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ReplaceDeviceDto } from './dto/replace-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}
  @Post() @Roles(UserRole.ADMIN) create(
    @Body() dto: CreateDeviceDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.create(dto, req.user.sub);
  }
  @Get() @Roles(UserRole.ADMIN, UserRole.CONTROLLER) list(
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.findAll(req.user.sub);
  }
  @Get(':id') @Roles(UserRole.ADMIN, UserRole.CONTROLLER) detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.findOne(id, req.user.sub);
  }
  @Patch(':id') @Roles(UserRole.ADMIN) update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeviceDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.update(id, dto, req.user.sub);
  }
  @Post(':id/rotate-key') @Roles(UserRole.ADMIN) rotate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.rotateKey(id, req.user.sub);
  }
  @Post(':id/replace') @Roles(UserRole.ADMIN) replace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceDeviceDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.replace(id, dto, req.user.sub);
  }
  @Post(':id/activate') @Roles(UserRole.ADMIN) activate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.setLifecycle(id, DeviceLifecycle.ACTIVE, req.user.sub);
  }
  @Post(':id/disable') @Roles(UserRole.ADMIN) disable(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.setLifecycle(
      id,
      DeviceLifecycle.DISABLED,
      req.user.sub,
    );
  }
  @Post(':id/retire') @Roles(UserRole.ADMIN) retire(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.setLifecycle(id, DeviceLifecycle.RETIRED, req.user.sub);
  }
  @Delete(':id') @Roles(UserRole.ADMIN) legacyDisable(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.devices.setLifecycle(
      id,
      DeviceLifecycle.DISABLED,
      req.user.sub,
    );
  }
}
