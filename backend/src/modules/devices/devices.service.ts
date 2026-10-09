import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { ConnectivityState, Device, DeviceLifecycle } from './device.entity';
import { DeviceBinding } from './device-binding.entity';
import { DeviceKeyAudit } from './device-key-audit.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ReplaceDeviceDto } from './dto/replace-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Equipment } from '../equipment/equipment.entity';
import {
  MonitoringService,
  EquipmentAccessService,
} from '../monitoring/monitoring.service';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { AuditTrailService } from '../billing/audit-trail.service';

export function newDeviceCredential() {
  const identifier = randomBytes(8).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  const apiKey = `ap_${identifier}.${secret}`;
  return {
    apiKey,
    identifier,
    hash: createHash('sha256').update(apiKey).digest('hex'),
  };
}
@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Equipment)
    private readonly equipment: Repository<Equipment>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly access: EquipmentAccessService,
    private readonly monitoring: MonitoringService,
    private readonly auditTrail: AuditTrailService,
  ) {}

  async create(dto: CreateDeviceDto, actorId: string) {
    const equipment = await this.enrollable(
      dto.organizationId,
      dto.siteId,
      dto.equipmentId,
    );
    this.validateIntervals(
      dto.heartbeatIntervalSeconds ?? 30,
      dto.offlineTimeoutSeconds ?? 120,
    );
    if (
      await this.devices.exists({ where: { currentEquipmentId: equipment.id } })
    )
      throw new BadRequestException(
        'Equipment already has a current monitor; use replacement',
      );
    const credential = newDeviceCredential();
    let device!: Device;
    await this.dataSource.transaction(async (manager) => {
      device = await manager.save(
        Device,
        manager.create(Device, {
          name: dto.name.trim(),
          location: equipment.site.name,
          organizationId: dto.organizationId,
          currentEquipmentId: equipment.id,
          deviceIdentifier: dto.deviceIdentifier.trim(),
          hardwareModel: dto.hardwareModel?.trim() || null,
          firmwareVersion: dto.firmwareVersion?.trim() || null,
          lifecycleState: DeviceLifecycle.ACTIVE,
          isActive: true,
          credentialId: credential.identifier,
          credentialHash: credential.hash,
          heartbeatIntervalSeconds: dto.heartbeatIntervalSeconds ?? 30,
          offlineTimeoutSeconds: dto.offlineTimeoutSeconds ?? 120,
          connectivityState: ConnectivityState.NEVER_CONNECTED,
          provisionedAt: new Date(),
        }),
      );
      await manager.save(
        DeviceBinding,
        manager.create(DeviceBinding, {
          deviceId: device.id,
          equipmentId: equipment.id,
          startedAt: new Date(),
        }),
      );
      await manager.save(
        DeviceKeyAudit,
        manager.create(DeviceKeyAudit, {
          deviceId: device.id,
          actorId,
          action: 'PROVISION',
        }),
      );
    });
    return {
      device: await this.findOne(device.id, actorId),
      apiKey: credential.apiKey,
      provisioning: this.provisioning(device),
    };
  }
  async replace(id: string, dto: ReplaceDeviceDto, actorId: string) {
    await this.assertAdmin(actorId);
    const old = await this.getEntity(id);
    if (
      !old.currentEquipmentId ||
      old.lifecycleState === DeviceLifecycle.RETIRED
    )
      throw new BadRequestException(
        'Only a currently bound monitor can be replaced',
      );
    const equipment = await this.equipment.findOne({
      where: { id: old.currentEquipmentId },
      relations: ['site', 'organization'],
    });
    if (
      !equipment ||
      !equipment.isActive ||
      !equipment.organization?.isActive ||
      !equipment.site?.isActive
    )
      throw new BadRequestException('Active equipment and site required');
    this.validateIntervals(
      dto.heartbeatIntervalSeconds ?? 30,
      dto.offlineTimeoutSeconds ?? 120,
    );
    const credential = newDeviceCredential();
    let device!: Device;
    await this.dataSource.transaction(async (manager) => {
      const now = new Date();
      await manager.update(Device, id, {
        currentEquipmentId: null,
        lifecycleState: DeviceLifecycle.RETIRED,
        isActive: false,
      });
      await manager.update(
        DeviceBinding,
        { deviceId: id, endedAt: null },
        { endedAt: now },
      );
      device = await manager.save(
        Device,
        manager.create(Device, {
          name: dto.name.trim(),
          location: equipment.site.name,
          organizationId: old.organizationId,
          currentEquipmentId: equipment.id,
          deviceIdentifier: dto.deviceIdentifier.trim(),
          hardwareModel: dto.hardwareModel?.trim() || null,
          firmwareVersion: dto.firmwareVersion?.trim() || null,
          lifecycleState: DeviceLifecycle.ACTIVE,
          isActive: true,
          credentialId: credential.identifier,
          credentialHash: credential.hash,
          heartbeatIntervalSeconds: dto.heartbeatIntervalSeconds ?? 30,
          offlineTimeoutSeconds: dto.offlineTimeoutSeconds ?? 120,
          connectivityState: ConnectivityState.NEVER_CONNECTED,
          provisionedAt: now,
        }),
      );
      await manager.save(
        DeviceBinding,
        manager.create(DeviceBinding, {
          deviceId: device.id,
          equipmentId: equipment.id,
          startedAt: now,
        }),
      );
      await manager.save(
        DeviceKeyAudit,
        manager.create(DeviceKeyAudit, {
          deviceId: device.id,
          actorId,
          action: 'PROVISION',
        }),
      );
    });
    return {
      device: await this.findOne(device.id, actorId),
      apiKey: credential.apiKey,
      provisioning: this.provisioning(device),
    };
  }
  async findAll(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return [];
    let query = this.devices
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.equipment', 'e')
      .leftJoinAndSelect('e.site', 's');
    if (user.role === UserRole.CONTROLLER) {
      const ids = await this.access.ids(userId);
      if (!ids.length) return [];
      query = query
        .where('d.current_equipment_id IN (:...ids)', { ids })
        .andWhere('d.organization_id=:organizationId', {
          organizationId: user.organizationId,
        });
    }
    const rows = await query.orderBy('d.name', 'ASC').getMany();
    return Promise.all(rows.map((row) => this.safe(row)));
  }
  async findOne(id: string, userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Monitor not found');
    const row = await this.devices.findOne({
      where: { id },
      relations: ['equipment', 'equipment.site'],
    });
    if (!row) throw new NotFoundException('Monitor not found');
    if (user.role === UserRole.CONTROLLER) {
      const ids = await this.access.ids(userId);
      if (
        !row.currentEquipmentId ||
        !ids.includes(row.currentEquipmentId) ||
        row.organizationId !== user.organizationId
      )
        throw new NotFoundException('Monitor not found');
    }
    return this.safe(row);
  }
  async update(id: string, dto: UpdateDeviceDto, actorId: string) {
    await this.assertAdmin(actorId);
    const device = await this.getEntity(id);
    const heartbeat =
      dto.heartbeatIntervalSeconds ?? device.heartbeatIntervalSeconds;
    const offline = dto.offlineTimeoutSeconds ?? device.offlineTimeoutSeconds;
    this.validateIntervals(heartbeat, offline);
    if (dto.name !== undefined) device.name = dto.name.trim();
    if (dto.hardwareModel !== undefined)
      device.hardwareModel = dto.hardwareModel.trim() || null;
    if (dto.firmwareVersion !== undefined)
      device.firmwareVersion = dto.firmwareVersion.trim() || null;
    device.heartbeatIntervalSeconds = heartbeat;
    device.offlineTimeoutSeconds = offline;
    await this.devices.save(device);
    return this.findOne(id, actorId);
  }
  async setLifecycle(id: string, state: DeviceLifecycle, actorId: string) {
    await this.assertAdmin(actorId);
    const device = await this.getEntity(id);
    if (
      device.lifecycleState === DeviceLifecycle.RETIRED &&
      state !== DeviceLifecycle.RETIRED
    )
      throw new BadRequestException('Retired monitors cannot be reactivated');
    if (state === DeviceLifecycle.ACTIVE) {
      if (!device.currentEquipmentId)
        throw new BadRequestException('Monitor must be bound to equipment');
      const equipment = await this.equipment.findOne({
        where: { id: device.currentEquipmentId },
        relations: ['organization'],
      });
      if (!equipment?.isActive || !equipment.organization?.isActive)
        throw new BadRequestException('Equipment or organization is inactive');
    }
    if (state === DeviceLifecycle.RETIRED && device.currentEquipmentId) {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          DeviceBinding,
          { deviceId: id, endedAt: null },
          { endedAt: new Date() },
        );
        await manager.update(Device, id, {
          currentEquipmentId: null,
          lifecycleState: state,
          isActive: false,
        });
      });
    } else {
      device.lifecycleState = state;
      device.isActive = state === DeviceLifecycle.ACTIVE;
      await this.devices.save(device);
    }
    return this.findOne(id, actorId);
  }
  async rotateKey(id: string, actorId: string) {
    await this.assertAdmin(actorId);
    const device = await this.getEntity(id);
    if (device.lifecycleState === DeviceLifecycle.RETIRED)
      throw new BadRequestException('Retired monitor cannot rotate its key');
    const credential = newDeviceCredential();
    device.credentialId = credential.identifier;
    device.credentialHash = credential.hash;
    device.rotatedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      await manager.save(device);
      await manager.save(
        DeviceKeyAudit,
        manager.create(DeviceKeyAudit, {
          deviceId: id,
          actorId,
          action: 'ROTATE',
        }),
      );
      await this.auditTrail.record(
        {
          actorId,
          actorRole: 'Admin',
          organizationId: device.organizationId,
          action: 'API_KEY_ROTATED',
          entityType: 'device',
          entityId: id,
          after: { action: 'ROTATE' },
        },
        manager,
      );
    });
    return {
      device: await this.findOne(id, actorId),
      apiKey: credential.apiKey,
      provisioning: this.provisioning(device),
    };
  }
  private async safe(device: Device) {
    const equipment = device.equipment;
    const snapshot = equipment
      ? await this.monitoring.snapshot(equipment)
      : null;
    return {
      id: device.id,
      name: device.name,
      location: device.location,
      organizationId: device.organizationId,
      equipmentId: device.currentEquipmentId,
      equipment: equipment
        ? {
            id: equipment.id,
            name: equipment.name,
            type: equipment.type,
            monitoringDefinition: equipment.monitoringDefinition,
            site: equipment.site
              ? { id: equipment.site.id, name: equipment.site.name }
              : null,
          }
        : null,
      deviceIdentifier: device.deviceIdentifier,
      hardwareModel: device.hardwareModel,
      firmwareVersion: device.firmwareVersion,
      lifecycleState: device.lifecycleState,
      isActive: device.isActive,
      connectivity: snapshot?.connectivity ?? 'NEVER_CONNECTED',
      currentStatus: snapshot?.state ?? 'UNKNOWN',
      lastKnownStatus: snapshot?.lastKnownStatus ?? null,
      lastReadingAt: snapshot?.lastConfirmedAt ?? null,
      firstSeenAt: device.firstSeenAt,
      lastSeenAt: device.lastSeenAt,
      heartbeatIntervalSeconds: device.heartbeatIntervalSeconds,
      offlineTimeoutSeconds: device.offlineTimeoutSeconds,
      provisionedAt: device.provisionedAt,
      rotatedAt: device.rotatedAt,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
  private provisioning(device: Device) {
    return {
      endpoint: '/sensors/status',
      heartbeatEndpoint: '/sensors/heartbeat',
      authorization: 'ApiKey <key>',
      deviceIdentifier: device.deviceIdentifier,
      heartbeatIntervalSeconds: device.heartbeatIntervalSeconds,
      offlineTimeoutSeconds: device.offlineTimeoutSeconds,
      requiresHttpsInProduction: true,
    };
  }
  private async enrollable(orgId: string, siteId: string, equipmentId: string) {
    const [organization, equipment] = await Promise.all([
      this.organizations.findOne({ where: { id: orgId, isActive: true } }),
      this.equipment.findOne({
        where: {
          id: equipmentId,
          organizationId: orgId,
          siteId,
          isActive: true,
        },
        relations: ['site'],
      }),
    ]);
    if (!organization || !equipment?.site?.isActive)
      throw new BadRequestException(
        'Active equipment at an active site required',
      );
    return equipment;
  }
  private validateIntervals(heartbeat: number, offline: number) {
    if (offline <= heartbeat)
      throw new BadRequestException(
        'Offline timeout must exceed heartbeat interval',
      );
  }
  private async getEntity(id: string) {
    const device = await this.devices.findOne({ where: { id } });
    if (!device) throw new NotFoundException('Monitor not found');
    return device;
  }
  private async assertAdmin(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || user.role !== UserRole.ADMIN)
      throw new NotFoundException('Monitor not found');
  }
}
