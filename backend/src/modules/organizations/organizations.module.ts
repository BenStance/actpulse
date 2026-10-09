import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Device } from '../devices/device.entity';
import { User } from '../users/user.entity';
import { Organization } from './organization.entity';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, User, Device])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, JwtAuthGuard, RolesGuard],
  exports: [OrganizationsService, TypeOrmModule],
})
export class OrganizationsModule {}
