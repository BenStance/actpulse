import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations/organization.entity';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { Site } from './site.entity';
import { SitesController } from './sites.controller';
import { SitesService } from './sites.service';
@Module({
  imports: [TypeOrmModule.forFeature([Site, Organization]), MonitoringModule],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService, TypeOrmModule],
})
export class SitesModule {}
