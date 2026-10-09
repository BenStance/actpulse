"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesService = void 0;
exports.newDeviceCredential = newDeviceCredential;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const device_entity_1 = require("./device.entity");
const device_binding_entity_1 = require("./device-binding.entity");
const device_key_audit_entity_1 = require("./device-key-audit.entity");
const equipment_entity_1 = require("../equipment/equipment.entity");
const monitoring_service_1 = require("../monitoring/monitoring.service");
const organization_entity_1 = require("../organizations/organization.entity");
const user_entity_1 = require("../users/user.entity");
const audit_trail_service_1 = require("../billing/audit-trail.service");
function newDeviceCredential() {
    const identifier = (0, crypto_1.randomBytes)(8).toString('hex');
    const secret = (0, crypto_1.randomBytes)(32).toString('base64url');
    const apiKey = `ap_${identifier}.${secret}`;
    return {
        apiKey,
        identifier,
        hash: (0, crypto_1.createHash)('sha256').update(apiKey).digest('hex'),
    };
}
let DevicesService = class DevicesService {
    devices;
    equipment;
    organizations;
    users;
    dataSource;
    access;
    monitoring;
    auditTrail;
    constructor(devices, equipment, organizations, users, dataSource, access, monitoring, auditTrail) {
        this.devices = devices;
        this.equipment = equipment;
        this.organizations = organizations;
        this.users = users;
        this.dataSource = dataSource;
        this.access = access;
        this.monitoring = monitoring;
        this.auditTrail = auditTrail;
    }
    async create(dto, actorId) {
        const equipment = await this.enrollable(dto.organizationId, dto.siteId, dto.equipmentId);
        this.validateIntervals(dto.heartbeatIntervalSeconds ?? 30, dto.offlineTimeoutSeconds ?? 120);
        if (await this.devices.exists({ where: { currentEquipmentId: equipment.id } }))
            throw new common_1.BadRequestException('Equipment already has a current monitor; use replacement');
        const credential = newDeviceCredential();
        let device;
        await this.dataSource.transaction(async (manager) => {
            device = await manager.save(device_entity_1.Device, manager.create(device_entity_1.Device, {
                name: dto.name.trim(),
                location: equipment.site.name,
                organizationId: dto.organizationId,
                currentEquipmentId: equipment.id,
                deviceIdentifier: dto.deviceIdentifier.trim(),
                hardwareModel: dto.hardwareModel?.trim() || null,
                firmwareVersion: dto.firmwareVersion?.trim() || null,
                lifecycleState: device_entity_1.DeviceLifecycle.ACTIVE,
                isActive: true,
                credentialId: credential.identifier,
                credentialHash: credential.hash,
                heartbeatIntervalSeconds: dto.heartbeatIntervalSeconds ?? 30,
                offlineTimeoutSeconds: dto.offlineTimeoutSeconds ?? 120,
                connectivityState: device_entity_1.ConnectivityState.NEVER_CONNECTED,
                provisionedAt: new Date(),
            }));
            await manager.save(device_binding_entity_1.DeviceBinding, manager.create(device_binding_entity_1.DeviceBinding, {
                deviceId: device.id,
                equipmentId: equipment.id,
                startedAt: new Date(),
            }));
            await manager.save(device_key_audit_entity_1.DeviceKeyAudit, manager.create(device_key_audit_entity_1.DeviceKeyAudit, {
                deviceId: device.id,
                actorId,
                action: 'PROVISION',
            }));
        });
        return {
            device: await this.findOne(device.id, actorId),
            apiKey: credential.apiKey,
            provisioning: this.provisioning(device),
        };
    }
    async replace(id, dto, actorId) {
        await this.assertAdmin(actorId);
        const old = await this.getEntity(id);
        if (!old.currentEquipmentId ||
            old.lifecycleState === device_entity_1.DeviceLifecycle.RETIRED)
            throw new common_1.BadRequestException('Only a currently bound monitor can be replaced');
        const equipment = await this.equipment.findOne({
            where: { id: old.currentEquipmentId },
            relations: ['site', 'organization'],
        });
        if (!equipment ||
            !equipment.isActive ||
            !equipment.organization?.isActive ||
            !equipment.site?.isActive)
            throw new common_1.BadRequestException('Active equipment and site required');
        this.validateIntervals(dto.heartbeatIntervalSeconds ?? 30, dto.offlineTimeoutSeconds ?? 120);
        const credential = newDeviceCredential();
        let device;
        await this.dataSource.transaction(async (manager) => {
            const now = new Date();
            await manager.update(device_entity_1.Device, id, {
                currentEquipmentId: null,
                lifecycleState: device_entity_1.DeviceLifecycle.RETIRED,
                isActive: false,
            });
            await manager.update(device_binding_entity_1.DeviceBinding, { deviceId: id, endedAt: null }, { endedAt: now });
            device = await manager.save(device_entity_1.Device, manager.create(device_entity_1.Device, {
                name: dto.name.trim(),
                location: equipment.site.name,
                organizationId: old.organizationId,
                currentEquipmentId: equipment.id,
                deviceIdentifier: dto.deviceIdentifier.trim(),
                hardwareModel: dto.hardwareModel?.trim() || null,
                firmwareVersion: dto.firmwareVersion?.trim() || null,
                lifecycleState: device_entity_1.DeviceLifecycle.ACTIVE,
                isActive: true,
                credentialId: credential.identifier,
                credentialHash: credential.hash,
                heartbeatIntervalSeconds: dto.heartbeatIntervalSeconds ?? 30,
                offlineTimeoutSeconds: dto.offlineTimeoutSeconds ?? 120,
                connectivityState: device_entity_1.ConnectivityState.NEVER_CONNECTED,
                provisionedAt: now,
            }));
            await manager.save(device_binding_entity_1.DeviceBinding, manager.create(device_binding_entity_1.DeviceBinding, {
                deviceId: device.id,
                equipmentId: equipment.id,
                startedAt: now,
            }));
            await manager.save(device_key_audit_entity_1.DeviceKeyAudit, manager.create(device_key_audit_entity_1.DeviceKeyAudit, {
                deviceId: device.id,
                actorId,
                action: 'PROVISION',
            }));
        });
        return {
            device: await this.findOne(device.id, actorId),
            apiKey: credential.apiKey,
            provisioning: this.provisioning(device),
        };
    }
    async findAll(userId) {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user)
            return [];
        let query = this.devices
            .createQueryBuilder('d')
            .leftJoinAndSelect('d.equipment', 'e')
            .leftJoinAndSelect('e.site', 's');
        if (user.role === user_role_enum_1.UserRole.CONTROLLER) {
            const ids = await this.access.ids(userId);
            if (!ids.length)
                return [];
            query = query
                .where('d.current_equipment_id IN (:...ids)', { ids })
                .andWhere('d.organization_id=:organizationId', {
                organizationId: user.organizationId,
            });
        }
        const rows = await query.orderBy('d.name', 'ASC').getMany();
        return Promise.all(rows.map((row) => this.safe(row)));
    }
    async findOne(id, userId) {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('Monitor not found');
        const row = await this.devices.findOne({
            where: { id },
            relations: ['equipment', 'equipment.site'],
        });
        if (!row)
            throw new common_1.NotFoundException('Monitor not found');
        if (user.role === user_role_enum_1.UserRole.CONTROLLER) {
            const ids = await this.access.ids(userId);
            if (!row.currentEquipmentId ||
                !ids.includes(row.currentEquipmentId) ||
                row.organizationId !== user.organizationId)
                throw new common_1.NotFoundException('Monitor not found');
        }
        return this.safe(row);
    }
    async update(id, dto, actorId) {
        await this.assertAdmin(actorId);
        const device = await this.getEntity(id);
        const heartbeat = dto.heartbeatIntervalSeconds ?? device.heartbeatIntervalSeconds;
        const offline = dto.offlineTimeoutSeconds ?? device.offlineTimeoutSeconds;
        this.validateIntervals(heartbeat, offline);
        if (dto.name !== undefined)
            device.name = dto.name.trim();
        if (dto.hardwareModel !== undefined)
            device.hardwareModel = dto.hardwareModel.trim() || null;
        if (dto.firmwareVersion !== undefined)
            device.firmwareVersion = dto.firmwareVersion.trim() || null;
        device.heartbeatIntervalSeconds = heartbeat;
        device.offlineTimeoutSeconds = offline;
        await this.devices.save(device);
        return this.findOne(id, actorId);
    }
    async setLifecycle(id, state, actorId) {
        await this.assertAdmin(actorId);
        const device = await this.getEntity(id);
        if (device.lifecycleState === device_entity_1.DeviceLifecycle.RETIRED &&
            state !== device_entity_1.DeviceLifecycle.RETIRED)
            throw new common_1.BadRequestException('Retired monitors cannot be reactivated');
        if (state === device_entity_1.DeviceLifecycle.ACTIVE) {
            if (!device.currentEquipmentId)
                throw new common_1.BadRequestException('Monitor must be bound to equipment');
            const equipment = await this.equipment.findOne({
                where: { id: device.currentEquipmentId },
                relations: ['organization'],
            });
            if (!equipment?.isActive || !equipment.organization?.isActive)
                throw new common_1.BadRequestException('Equipment or organization is inactive');
        }
        if (state === device_entity_1.DeviceLifecycle.RETIRED && device.currentEquipmentId) {
            await this.dataSource.transaction(async (manager) => {
                await manager.update(device_binding_entity_1.DeviceBinding, { deviceId: id, endedAt: null }, { endedAt: new Date() });
                await manager.update(device_entity_1.Device, id, {
                    currentEquipmentId: null,
                    lifecycleState: state,
                    isActive: false,
                });
            });
        }
        else {
            device.lifecycleState = state;
            device.isActive = state === device_entity_1.DeviceLifecycle.ACTIVE;
            await this.devices.save(device);
        }
        return this.findOne(id, actorId);
    }
    async rotateKey(id, actorId) {
        await this.assertAdmin(actorId);
        const device = await this.getEntity(id);
        if (device.lifecycleState === device_entity_1.DeviceLifecycle.RETIRED)
            throw new common_1.BadRequestException('Retired monitor cannot rotate its key');
        const credential = newDeviceCredential();
        device.credentialId = credential.identifier;
        device.credentialHash = credential.hash;
        device.rotatedAt = new Date();
        await this.dataSource.transaction(async (manager) => {
            await manager.save(device);
            await manager.save(device_key_audit_entity_1.DeviceKeyAudit, manager.create(device_key_audit_entity_1.DeviceKeyAudit, {
                deviceId: id,
                actorId,
                action: 'ROTATE',
            }));
            await this.auditTrail.record({
                actorId,
                actorRole: 'Admin',
                organizationId: device.organizationId,
                action: 'API_KEY_ROTATED',
                entityType: 'device',
                entityId: id,
                after: { action: 'ROTATE' },
            }, manager);
        });
        return {
            device: await this.findOne(id, actorId),
            apiKey: credential.apiKey,
            provisioning: this.provisioning(device),
        };
    }
    async safe(device) {
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
    provisioning(device) {
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
    async enrollable(orgId, siteId, equipmentId) {
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
            throw new common_1.BadRequestException('Active equipment at an active site required');
        return equipment;
    }
    validateIntervals(heartbeat, offline) {
        if (offline <= heartbeat)
            throw new common_1.BadRequestException('Offline timeout must exceed heartbeat interval');
    }
    async getEntity(id) {
        const device = await this.devices.findOne({ where: { id } });
        if (!device)
            throw new common_1.NotFoundException('Monitor not found');
        return device;
    }
    async assertAdmin(userId) {
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user || user.role !== user_role_enum_1.UserRole.ADMIN)
            throw new common_1.NotFoundException('Monitor not found');
    }
};
exports.DevicesService = DevicesService;
exports.DevicesService = DevicesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(device_entity_1.Device)),
    __param(1, (0, typeorm_1.InjectRepository)(equipment_entity_1.Equipment)),
    __param(2, (0, typeorm_1.InjectRepository)(organization_entity_1.Organization)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        monitoring_service_1.EquipmentAccessService,
        monitoring_service_1.MonitoringService,
        audit_trail_service_1.AuditTrailService])
], DevicesService);
//# sourceMappingURL=devices.service.js.map