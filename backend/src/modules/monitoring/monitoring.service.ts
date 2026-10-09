import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Device, ConnectivityState } from '../devices/device.entity';
import { DeviceBinding } from '../devices/device-binding.entity';
import { Equipment } from '../equipment/equipment.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { SensorStatus } from '../../common/enums/sensor-status.enum';
import { User } from '../users/user.entity';
import { ConnectivityEvent } from './connectivity-event.entity';
import {
  calculateDurations,
  dailyDurations,
  localDay,
  utcForLocalMidnight,
} from './duration-calculator';

export type PeriodOptions = {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
};

@Injectable()
export class EquipmentAccessService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Equipment)
    private readonly equipment: Repository<Equipment>,
  ) {}
  async ids(userId: string): Promise<string[]> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: ['equipment', 'organization'],
    });
    if (
      !user?.isActive ||
      !user.isActivated ||
      (user.organization && !user.organization.isActive)
    )
      return [];
    if (user.role === UserRole.ADMIN)
      return (await this.equipment.find({ select: { id: true } })).map(
        (row) => row.id,
      );
    if (user.role !== UserRole.CONTROLLER || !user.organizationId) return [];
    return (user.equipment ?? [])
      .filter((row) => row.organizationId === user.organizationId)
      .map((row) => row.id);
  }
  async one(userId: string, id: string): Promise<Equipment> {
    const ids = await this.ids(userId);
    if (!ids.includes(id)) throw new NotFoundException('Equipment not found');
    const row = await this.equipment.findOne({
      where: { id },
      relations: ['site', 'organization'],
    });
    if (!row) throw new NotFoundException('Equipment not found');
    return row;
  }
}

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(DeviceBinding)
    private readonly bindings: Repository<DeviceBinding>,
    @InjectRepository(SensorLog) private readonly logs: Repository<SensorLog>,
    @InjectRepository(ConnectivityEvent)
    private readonly connectivityEvents: Repository<ConnectivityEvent>,
    private readonly access: EquipmentAccessService,
  ) {}

  validateTimezone(timezone: string): string {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return timezone;
    } catch {
      throw new BadRequestException('Valid IANA timezone required');
    }
  }
  resolvePeriod(
    options: PeriodOptions,
    defaultTimezone = 'Africa/Dar_es_Salaam',
  ) {
    const timezone = this.validateTimezone(options.timezone || defaultTimezone);
    const now = new Date();
    let from: Date;
    let to: Date;
    if (
      options.preset === 'today' ||
      options.preset === '7d' ||
      options.preset === '30d' ||
      !options.from ||
      !options.to
    ) {
      const today = localDay(now, timezone);
      const days =
        options.preset === '30d' ? 30 : options.preset === '7d' ? 7 : 1;
      const startDay = new Date(`${today}T00:00:00Z`);
      startDay.setUTCDate(startDay.getUTCDate() - (days - 1));
      from = utcForLocalMidnight(startDay.toISOString().slice(0, 10), timezone);
      to = now;
    } else {
      from = new Date(options.from);
      to = new Date(options.to);
    }
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 366 * 86400000
    )
      throw new BadRequestException(
        'Use a valid interval no longer than 366 days',
      );
    if (to.getTime() > now.getTime() + 300000)
      throw new BadRequestException('Report end cannot be in the future');
    return { from, to, timezone };
  }

  async snapshot(equipment: Equipment, now = new Date()) {
    const lastKnown = await this.logs.findOne({
      where: { equipmentId: equipment.id },
      order: { recordedAt: 'DESC', id: 'DESC' },
    });
    const device = await this.devices.findOne({
      where: { currentEquipmentId: equipment.id },
    });
    if (!device)
      return {
        state: 'UNKNOWN',
        confidence: 'UNKNOWN',
        lastKnownStatus: lastKnown?.status ?? null,
        lastConfirmedAt: lastKnown?.recordedAt ?? null,
        connectivity: 'NEVER_CONNECTED',
        lastSeenAt: null,
        firstSeenAt: null,
        monitor: null,
        currentObservedSessionMs: null,
      };
    const latest = await this.logs.findOne({
      where: { equipmentId: equipment.id, deviceId: device.id },
      order: { recordedAt: 'DESC', id: 'DESC' },
    });
    const online =
      !!device.lastSeenAt &&
      now.getTime() - device.lastSeenAt.getTime() <=
        device.offlineTimeoutSeconds * 1000;
    const connectivity = device.lastSeenAt
      ? online
        ? ConnectivityState.ONLINE
        : ConnectivityState.OFFLINE
      : ConnectivityState.NEVER_CONNECTED;
    const confirmed =
      !!latest &&
      online &&
      !!device.lastStatusAt &&
      !!device.connectedSinceAt &&
      latest.receivedAt.getTime() >= device.connectedSinceAt.getTime() &&
      now.getTime() - device.lastStatusAt.getTime() <=
        device.offlineTimeoutSeconds * 1000;
    const state = confirmed ? latest.status : 'UNKNOWN';
    const currentObservedSessionMs =
      confirmed && state === SensorStatus.ON && latest
        ? Math.max(0, now.getTime() - latest.recordedAt.getTime())
        : null;
    return {
      state,
      confidence: confirmed ? 'KNOWN' : 'UNKNOWN',
      lastKnownStatus: lastKnown?.status ?? null,
      lastConfirmedAt: lastKnown?.recordedAt ?? null,
      connectivity,
      lastSeenAt: device.lastSeenAt,
      firstSeenAt: device.firstSeenAt,
      monitor: {
        id: device.id,
        name: device.name,
        deviceIdentifier: device.deviceIdentifier,
        lifecycleState: device.lifecycleState,
        hardwareModel: device.hardwareModel,
        firmwareVersion: device.firmwareVersion,
        offlineTimeoutSeconds: device.offlineTimeoutSeconds,
      },
      currentObservedSessionMs,
    };
  }

  async metrics(
    equipment: Equipment,
    from: Date,
    to: Date,
    timezone = equipment.site?.timezone || 'Africa/Dar_es_Salaam',
  ) {
    this.validateTimezone(timezone);
    const bindings = await this.bindings.find({
      where: { equipmentId: equipment.id },
      order: { startedAt: 'ASC' },
    });
    const ids = bindings.map((row) => row.deviceId);
    const devices = ids.length
      ? await this.devices.find({ where: { id: In(ids) } })
      : [];
    const timeout = new Map(
      devices.map((row) => [row.id, row.offlineTimeoutSeconds * 1000]),
    );
    const maxTimeout = Math.max(120000, ...timeout.values());
    const observations = ids.length
      ? await this.logs.find({
          where: {
            equipmentId: equipment.id,
            recordedAt: Between(new Date(from.getTime() - maxTimeout), to),
          },
          order: { recordedAt: 'ASC', id: 'ASC' },
        })
      : [];
    const result = calculateDurations(
      observations,
      bindings.map((row) => ({
        deviceId: row.deviceId,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        timeoutMs: timeout.get(row.deviceId) ?? 120000,
      })),
      from,
      to,
    );
    return {
      ...result,
      timezone,
      daily: dailyDurations(result.segments, from, to, timezone),
    };
  }

  async events(
    equipmentId: string,
    from: Date,
    to: Date,
    page = 1,
    pageSize = 25,
  ) {
    const boundedPage = Math.max(1, Math.floor(page) || 1);
    const boundedSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 25));
    const [observations, totalObservations, connections, totalConnections] =
      await Promise.all([
        this.logs.find({
          where: { equipmentId, recordedAt: Between(from, to) },
          order: { recordedAt: 'DESC' },
          take: boundedPage * boundedSize,
        }),
        this.logs.count({
          where: { equipmentId, recordedAt: Between(from, to) },
        }),
        this.connectivityEvents.find({
          where: { equipmentId, occurredAt: Between(from, to) },
          order: { occurredAt: 'DESC' },
          take: boundedPage * boundedSize,
        }),
        this.connectivityEvents.count({
          where: { equipmentId, occurredAt: Between(from, to) },
        }),
      ]);
    const items = [
      ...observations.map((row) => ({
        id: row.id,
        type: 'OBSERVATION',
        status: row.status,
        kind: row.kind,
        deviceId: row.deviceId,
        at: row.recordedAt,
        source: row.source,
        timestampBasis: row.timestampBasis,
      })),
      ...connections.map((row) => ({
        id: row.id,
        type: 'CONNECTIVITY',
        status: row.type,
        kind: null,
        deviceId: row.deviceId,
        at: row.occurredAt,
        source: null,
        timestampBasis: null,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice((boundedPage - 1) * boundedSize, boundedPage * boundedSize);
    return {
      items,
      total: totalObservations + totalConnections,
      page: boundedPage,
      pageSize: boundedSize,
    };
  }

  async scopedEquipment(
    userId: string,
    filters: {
      organizationId?: string;
      siteId?: string;
      type?: string;
      active?: boolean;
    } = {},
  ) {
    const ids = await this.access.ids(userId);
    if (!ids.length) return [];
    const query = this.devices.manager
      .getRepository(Equipment)
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.site', 'site')
      .where('e.id IN (:...ids)', { ids });
    if (filters.organizationId)
      query.andWhere('e.organization_id=:organizationId', {
        organizationId: filters.organizationId,
      });
    if (filters.siteId)
      query.andWhere('e.site_id=:siteId', { siteId: filters.siteId });
    if (filters.type) query.andWhere('e.type=:type', { type: filters.type });
    if (filters.active !== undefined)
      query.andWhere('e.is_active=:active', { active: filters.active });
    return query.orderBy('e.name', 'ASC').getMany();
  }
}
