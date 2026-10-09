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
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SiteActor, SitesService } from './sites.service';

@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}
  @Get()
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  list(
    @Req() req: { user: SiteActor },
    @Query('organizationId') organizationId?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    return this.sites.list(req.user, { organizationId, search, active });
  }
  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSiteDto) {
    return this.sites.create(dto);
  }
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.CONTROLLER)
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: SiteActor },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.sites.detail(id, req.user, from, to);
  }
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSiteDto) {
    return this.sites.update(id, dto);
  }
  @Post(':id/activate')
  @Roles(UserRole.ADMIN)
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.setActive(id, true);
  }
  @Post(':id/deactivate')
  @Roles(UserRole.ADMIN)
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.sites.setActive(id, false);
  }
}
