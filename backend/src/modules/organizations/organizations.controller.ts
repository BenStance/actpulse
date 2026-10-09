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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('me')
  @Roles(UserRole.CONTROLLER)
  me(@Req() req: { user: { organizationId: string | null } }) {
    return this.organizations.mySummary(req.user.organizationId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query('search') search?: string) {
    return this.organizations.list(search);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizations.create(dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.detail(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(id, dto);
  }

  @Post(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.setActive(id, true);
  }

  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizations.setActive(id, false);
  }
}
