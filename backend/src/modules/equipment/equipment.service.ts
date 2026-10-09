import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthSessionService } from '../auth/auth-session.service';
import { EntitlementService } from '../billing/entitlement.service';
import { Device } from '../devices/device.entity';
import {
  MonitoringService,
  EquipmentAccessService,
  PeriodOptions,
} from '../monitoring/monitoring.service';
import { Organization } from '../organizations/organization.entity';
import { Site } from '../sites/site.entity';
import { User } from '../users/user.entity';
import { AssignControllersDto } from './dto/assign-controllers.dto';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import {
  Equipment,
  EquipmentType,
  MonitoringDefinition,
} from './equipment.entity';

@Injectable()
export class EquipmentService {
  constructor(
    @InjectRepository(Equipment)
    private readonly equipment: Repository<Equipment>,
    @InjectRepository(Site) private readonly sites: Repository<Site>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly monitoring: MonitoringService,
    private readonly access: EquipmentAccessService,
    private readonly sessions: AuthSessionService,
    private readonly entitlements: EntitlementService,
  ) {}
  async list(
    userId: string,
    filters: {
      organizationId?: string;
      siteId?: string;
      type?: string;
      active?: string;
      search?: string;
    },
  ) {
    if (
      filters.type &&
      !Object.values(EquipmentType).includes(filters.type as EquipmentType)
    )
      throw new BadRequestException('Invalid equipment type');
    const rows = await this.monitoring.scopedEquipment(userId, {
      organizationId: filters.organizationId,
      siteId: filters.siteId,
      type: filters.type,
      active:
        filters.active === 'all'
          ? undefined
          : filters.active === 'false'
            ? false
            : true,
    });
    const matched = rows.filter(
      (row) =>
        !filters.search ||
        `${row.name} ${row.assetTag || ''}`
          .toLowerCase()
          .includes(filters.search.toLowerCase()),
    );
    return Promise.all(
      matched.map(async (row) => ({
        ...this.safe(row),
        snapshot: await this.monitoring.snapshot(row),
      })),
    );
  }
  async create(dto: CreateEquipmentDto) {
    await this.validateTarget(dto.organizationId, dto.siteId);
    this.validateProfile(dto);
    await this.checkAssetTag(dto.organizationId, dto.assetTag);
    const row = this.equipment.create({
      organizationId: dto.organizationId,
      siteId: dto.siteId,
      ...this.fields(dto),
      isActive: true,
    });
    await this.dataSource.transaction(async (manager) => {
      await this.entitlements.lockAndCheck(
        dto.organizationId,
        'equipment',
        manager,
      );
      await manager.save(row);
      if (
        row.type === EquipmentType.GENERATOR &&
        dto.tankCapacityLitres != null
      )
        await manager.query(
          'INSERT INTO fuel_tanks(organization_id,generator_id,name,capacity_litres) VALUES($1,$2,$3,$4)',
          [
            row.organizationId,
            row.id,
            'Dedicated tank',
            dto.tankCapacityLitres,
          ],
        );
    });
    return this.detailAdmin(row.id);
  }
  async update(id: string, dto: UpdateEquipmentDto) {
    const row = await this.entity(id);
    if (dto.siteId && dto.siteId !== row.siteId)
      await this.validateTarget(row.organizationId, dto.siteId);
    const combined = { ...row, ...dto };
    this.validateProfile(combined);
    if (dto.assetTag !== undefined && dto.assetTag !== row.assetTag)
      await this.checkAssetTag(row.organizationId, dto.assetTag, id);
    const existingTank: Array<{ id: string }> = await this.dataSource.query(
      'SELECT id FROM fuel_tanks WHERE generator_id=$1',
      [id],
    );
    if (dto.type === EquipmentType.UPS && existingTank.length)
      throw new BadRequestException(
        'Remove or archive the dedicated tank before changing equipment type',
      );
    if (dto.tankCapacityLitres != null) {
      const latest: Array<{ level_litres: string }> =
        await this.dataSource.query(
          'SELECT level_litres FROM fuel_readings WHERE tank_id=$1 AND voided_at IS NULL ORDER BY observed_at DESC LIMIT 1',
          [existingTank[0]?.id || null],
        );
      if (latest[0] && Number(latest[0].level_litres) > dto.tankCapacityLitres)
        throw new BadRequestException(
          'Tank capacity is below the latest valid reading',
        );
    }
    Object.assign(row, this.fields(dto));
    await this.dataSource.transaction(async (manager) => {
      await manager.save(row);
      if (
        row.type === EquipmentType.GENERATOR &&
        dto.tankCapacityLitres != null
      )
        await manager.query(
          `INSERT INTO fuel_tanks(organization_id,generator_id,name,capacity_litres) VALUES($1,$2,$3,$4)
          ON CONFLICT(generator_id) DO UPDATE SET capacity_litres=EXCLUDED.capacity_litres,updated_at=now()`,
          [row.organizationId, id, 'Dedicated tank', dto.tankCapacityLitres],
        );
    });
    return this.detailAdmin(id);
  }
  async setActive(id: string, active: boolean) {
    const row = await this.entity(id);
    await this.dataSource.transaction(async (manager) => {
      if (active && !row.isActive)
        await this.entitlements.lockAndCheck(
          row.organizationId,
          'equipment',
          manager,
        );
      row.isActive = active;
      await manager.save(row);
    });
    return this.detailAdmin(id);
  }
  async assignControllers(id: string, dto: AssignControllersDto) {
    const equipment = await this.entity(id);
    const unique = [...new Set(dto.controllerIds)];
    const controllers = unique.length
      ? await this.users.find({
          where: {
            id: In(unique),
            organizationId: equipment.organizationId,
            role: UserRole.CONTROLLER,
          },
        })
      : [];
    if (controllers.length !== unique.length)
      throw new BadRequestException(
        'All Controllers must belong to this organization',
      );
    const old: Array<{ user_id: string }> = await this.dataSource.query(
      'SELECT user_id FROM user_equipment WHERE equipment_id=$1',
      [id],
    );
    const affected = [
      ...new Set([...old.map((row) => row.user_id), ...unique]),
    ];
    await this.dataSource.transaction(async (manager) => {
      await manager.query('DELETE FROM user_equipment WHERE equipment_id=$1', [
        id,
      ]);
      for (const userId of unique)
        await manager.query(
          'INSERT INTO user_equipment(user_id,equipment_id) VALUES($1,$2)',
          [userId, id],
        );
      if (affected.length)
        await manager.increment(User, { id: In(affected) }, 'tokenVersion', 1);
    });
    affected.forEach((userId) => this.sessions.invalidateUser(userId));
    return this.detailAdmin(id);
  }
  async detail(id: string, userId: string, options: PeriodOptions = {}) {
    const row = await this.access.one(userId, id);
    const period = this.monitoring.resolvePeriod(options, row.site.timezone);
    const [snapshot, metrics, events] = await Promise.all([
      this.monitoring.snapshot(row),
      this.monitoring.metrics(row, period.from, period.to, period.timezone),
      this.monitoring.events(id, period.from, period.to, 1, 25),
    ]);
    let runningBaseline: {
      openingHours: number;
      openingAt: Date;
      observedEngineHours: number;
      trackedCumulativeHours: number;
      incomplete: boolean;
    } | null = null;
    if (
      row.monitoringDefinition === MonitoringDefinition.ENGINE_RUNNING &&
      row.openingRunningHours !== null &&
      row.openingHoursAt
    ) {
      const baseline = await this.monitoring.metrics(
        row,
        row.openingHoursAt,
        period.to,
        period.timezone,
      );
      runningBaseline = {
        openingHours: Number(row.openingRunningHours),
        openingAt: row.openingHoursAt,
        observedEngineHours: baseline.onMs / 3600000,
        trackedCumulativeHours:
          Number(row.openingRunningHours) + baseline.onMs / 3600000,
        incomplete: baseline.unknownMs > 0,
      };
    }
    return { ...this.safe(row), snapshot, metrics, events, runningBaseline };
  }
  async detailAdmin(id: string) {
    const row = await this.entity(id);
    const assigned: Array<{ user_id: string }> = await this.dataSource.query(
      'SELECT user_id FROM user_equipment WHERE equipment_id=$1',
      [id],
    );
    return {
      ...this.safe(row),
      assignedControllerIds: assigned.map((item) => item.user_id),
    };
  }
  async events(
    id: string,
    userId: string,
    options: PeriodOptions,
    page = 1,
    pageSize = 25,
  ) {
    const row = await this.access.one(userId, id);
    const period = this.monitoring.resolvePeriod(options, row.site.timezone);
    return {
      ...(await this.monitoring.events(
        id,
        period.from,
        period.to,
        page,
        pageSize,
      )),
      period,
    };
  }
  async entity(id: string) {
    const row = await this.equipment.findOne({
      where: { id },
      relations: ['site'],
    });
    if (!row) throw new NotFoundException('Equipment not found');
    return row;
  }
  private async validateTarget(organizationId: string, siteId: string) {
    const [organization, site] = await Promise.all([
      this.organizations.findOne({
        where: { id: organizationId, isActive: true },
      }),
      this.sites.findOne({
        where: { id: siteId, organizationId, isActive: true },
      }),
    ]);
    if (!organization || !site)
      throw new BadRequestException(
        'Active site in an active organization required',
      );
  }
  private validateProfile(dto: {
    type?: EquipmentType;
    monitoringDefinition?: MonitoringDefinition | null;
    openingHoursAt?: string | Date | null;
    openingRunningHours?: number | null;
    name?: string;
  }) {
    if (dto.type === EquipmentType.UNSPECIFIED)
      throw new BadRequestException('Classify equipment as Generator or UPS');
    if (
      dto.type === EquipmentType.UPS &&
      dto.monitoringDefinition !== MonitoringDefinition.OUTPUT_POWER_PRESENT
    )
      throw new BadRequestException('UPS input must mean output power present');
    if (
      dto.monitoringDefinition === undefined ||
      dto.monitoringDefinition === null
    )
      throw new BadRequestException('Monitoring definition required');
    if (
      (dto.openingRunningHours != null && !dto.openingHoursAt) ||
      (dto.openingHoursAt && dto.openingRunningHours == null)
    )
      throw new BadRequestException(
        'Opening meter hours and timestamp must be supplied together',
      );
    if (dto.openingHoursAt && new Date(dto.openingHoursAt) > new Date())
      throw new BadRequestException(
        'Opening meter timestamp cannot be in the future',
      );
    if (dto.name !== undefined && dto.name.trim().length < 2)
      throw new BadRequestException('Name must have at least two characters');
  }
  private async checkAssetTag(
    orgId: string,
    assetTag?: string,
    exceptId?: string,
  ) {
    if (!assetTag?.trim()) return;
    const existing = await this.equipment
      .createQueryBuilder('e')
      .where('e.organization_id=:orgId', { orgId })
      .andWhere('lower(e.asset_tag)=:tag', {
        tag: assetTag.trim().toLowerCase(),
      })
      .getOne();
    if (existing && existing.id !== exceptId)
      throw new BadRequestException(
        'Asset tag already exists in this organization',
      );
  }
  private fields(dto: Partial<CreateEquipmentDto>) {
    const result: Record<string, unknown> = {};
    for (const key of [
      'siteId',
      'type',
      'monitoringDefinition',
      'name',
      'assetTag',
      'manufacturer',
      'model',
      'serialNumber',
      'installationDate',
      'description',
      'ratedCapacityKva',
      'fuelType',
      'tankCapacityLitres',
      'openingRunningHours',
      'openingHoursAt',
      'serviceIntervalHours',
      'ratedCapacityKw',
      'batteryCapacityAh',
      'nominalBatteryVoltage',
      'batteryNotes',
    ] as const) {
      const value = dto[key];
      if (value !== undefined)
        result[key] = typeof value === 'string' ? value.trim() || null : value;
    }
    return result;
  }
  private safe(row: Equipment) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      siteId: row.siteId,
      site: row.site
        ? { id: row.site.id, name: row.site.name, timezone: row.site.timezone }
        : null,
      type: row.type,
      monitoringDefinition: row.monitoringDefinition,
      name: row.name,
      assetTag: row.assetTag,
      manufacturer: row.manufacturer,
      model: row.model,
      serialNumber: row.serialNumber,
      installationDate: row.installationDate,
      description: row.description,
      ratedCapacityKva: row.ratedCapacityKva,
      fuelType: row.fuelType,
      tankCapacityLitres: row.tankCapacityLitres,
      openingRunningHours: row.openingRunningHours,
      openingHoursAt: row.openingHoursAt,
      serviceIntervalHours: row.serviceIntervalHours,
      ratedCapacityKw: row.ratedCapacityKw,
      batteryCapacityAh: row.batteryCapacityAh,
      nominalBatteryVoltage: row.nominalBatteryVoltage,
      batteryNotes: row.batteryNotes,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
