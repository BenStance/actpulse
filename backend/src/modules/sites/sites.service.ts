import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { EntitlementService } from '../billing/entitlement.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { Organization } from '../organizations/organization.entity';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { Site } from './site.entity';

export type SiteActor = {
  sub: string;
  role: UserRole;
  organizationId: string | null;
};
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    private readonly monitoring: MonitoringService,
    private readonly dataSource: DataSource,
    private readonly entitlements: EntitlementService,
  ) {}
  async list(
    actor: SiteActor,
    filters: { organizationId?: string; search?: string; active?: string },
  ) {
    const query = this.sites.createQueryBuilder('s');
    if (actor.role === UserRole.CONTROLLER) {
      const equipment = await this.monitoring.scopedEquipment(actor.sub);
      const ids = [...new Set(equipment.map((row) => row.siteId))];
      if (!ids.length) return [];
      query.where('s.id IN (:...ids)', { ids });
    }
    if (filters.organizationId) {
      if (
        actor.role === UserRole.CONTROLLER &&
        filters.organizationId !== actor.organizationId
      )
        return [];
      query.andWhere('s.organization_id=:organizationId', {
        organizationId: filters.organizationId,
      });
    }
    if (filters.search?.trim())
      query.andWhere(
        '(lower(s.name) LIKE :search OR lower(s.site_code) LIKE :search)',
        { search: `%${filters.search.trim().toLowerCase()}%` },
      );
    if (filters.active !== 'all')
      query.andWhere('s.is_active=:active', {
        active: filters.active === 'false' ? false : true,
      });
    const rows = await query.orderBy('s.name', 'ASC').getMany();
    const accessible = await this.monitoring.scopedEquipment(actor.sub);
    return rows.map((site) => ({
      ...this.safe(site),
      equipmentCount: accessible.filter((row) => row.siteId === site.id).length,
    }));
  }
  async create(dto: CreateSiteDto) {
    const organization = await this.organizations.findOne({
      where: { id: dto.organizationId, isActive: true },
    });
    if (!organization)
      throw new BadRequestException('Active organization required');
    const site = this.sites.create({
      organizationId: dto.organizationId,
      ...this.fields(dto),
    });
    await this.dataSource.transaction(async (manager) => {
      await this.entitlements.lockAndCheck(
        dto.organizationId,
        'sites',
        manager,
      );
      await manager.save(site);
    });
    return this.safe(site);
  }
  async update(id: string, dto: UpdateSiteDto) {
    const site = await this.one(id);
    Object.assign(site, this.fields(dto));
    await this.sites.save(site);
    return this.safe(site);
  }
  async setActive(id: string, active: boolean) {
    const site = await this.one(id);
    await this.dataSource.transaction(async (manager) => {
      if (active && !site.isActive)
        await this.entitlements.lockAndCheck(
          site.organizationId,
          'sites',
          manager,
        );
      site.isActive = active;
      await manager.save(site);
    });
    return this.safe(site);
  }
  async detail(id: string, actor: SiteActor, from?: string, to?: string) {
    const site = await this.one(id);
    const equipment = await this.monitoring.scopedEquipment(actor.sub, {
      siteId: id,
    });
    if (actor.role === UserRole.CONTROLLER && !equipment.length)
      throw new NotFoundException('Site not found');
    const period = this.monitoring.resolvePeriod(
      {
        from,
        to,
        timezone: site.timezone,
        preset: from && to ? 'custom' : 'today',
      },
      site.timezone,
    );
    const rows = await Promise.all(
      equipment.map(async (row) => {
        const [snapshot, metrics] = await Promise.all([
          this.monitoring.snapshot(row),
          this.monitoring.metrics(row, period.from, period.to, site.timezone),
        ]);
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          monitoringDefinition: row.monitoringDefinition,
          isActive: row.isActive,
          snapshot,
          onMs: metrics.onMs,
          offMs: metrics.offMs,
          unknownMs: metrics.unknownMs,
        };
      }),
    );
    const recent = await Promise.all(
      equipment
        .slice(0, 20)
        .map((row) =>
          this.monitoring.events(row.id, period.from, period.to, 1, 5),
        ),
    );
    const events = recent
      .flatMap((result, index) =>
        result.items.map((event) => ({
          ...event,
          equipmentId: equipment[index].id,
          equipmentName: equipment[index].name,
        })),
      )
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 20);
    return {
      ...this.safe(site),
      period: { from: period.from, to: period.to, timezone: site.timezone },
      equipmentCount: rows.length,
      onCount: rows.filter((row) => row.snapshot.state === 'ON').length,
      offCount: rows.filter((row) => row.snapshot.state === 'OFF').length,
      unknownCount: rows.filter((row) => row.snapshot.state === 'UNKNOWN')
        .length,
      onlineCount: rows.filter((row) => row.snapshot.connectivity === 'ONLINE')
        .length,
      offlineCount: rows.filter(
        (row) => row.snapshot.connectivity === 'OFFLINE',
      ).length,
      neverConnectedCount: rows.filter(
        (row) => row.snapshot.connectivity === 'NEVER_CONNECTED',
      ).length,
      onMs: rows.reduce((sum, row) => sum + row.onMs, 0),
      unknownMs: rows.reduce((sum, row) => sum + row.unknownMs, 0),
      equipment: rows,
      recentEvents: events,
    };
  }
  async one(id: string) {
    const site = await this.sites.findOne({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    return site;
  }
  private fields(dto: Partial<CreateSiteDto>) {
    const output: Record<string, unknown> = {};
    for (const key of [
      'name',
      'siteCode',
      'description',
      'address',
      'cityRegion',
      'timezone',
      'contactName',
      'contactPhone',
    ] as const) {
      if (dto[key] !== undefined) output[key] = dto[key]?.trim() || null;
    }
    if (
      dto.name !== undefined &&
      (!dto.name.trim() || dto.name.trim().length < 2)
    )
      throw new BadRequestException(
        'Site name must have at least two characters',
      );
    if (dto.timezone !== undefined)
      output.timezone = this.monitoring.validateTimezone(dto.timezone);
    if (dto.latitude !== undefined) output.latitude = dto.latitude;
    if (dto.longitude !== undefined) output.longitude = dto.longitude;
    return output;
  }
  private safe(site: Site) {
    return {
      id: site.id,
      organizationId: site.organizationId,
      name: site.name,
      siteCode: site.siteCode,
      description: site.description,
      address: site.address,
      cityRegion: site.cityRegion,
      latitude: site.latitude,
      longitude: site.longitude,
      timezone: site.timezone,
      contactName: site.contactName,
      contactPhone: site.contactPhone,
      isActive: site.isActive,
      createdAt: site.createdAt,
      updatedAt: site.updatedAt,
    };
  }
}
