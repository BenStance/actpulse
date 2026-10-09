import { DataSource, Repository } from 'typeorm';
import { Device, DeviceLifecycle } from './device.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ReplaceDeviceDto } from './dto/replace-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Equipment } from '../equipment/equipment.entity';
import { MonitoringService, EquipmentAccessService } from '../monitoring/monitoring.service';
import { Organization } from '../organizations/organization.entity';
import { User } from '../users/user.entity';
import { AuditTrailService } from '../billing/audit-trail.service';
export declare function newDeviceCredential(): {
    apiKey: string;
    identifier: string;
    hash: string;
};
export declare class DevicesService {
    private readonly devices;
    private readonly equipment;
    private readonly organizations;
    private readonly users;
    private readonly dataSource;
    private readonly access;
    private readonly monitoring;
    private readonly auditTrail;
    constructor(devices: Repository<Device>, equipment: Repository<Equipment>, organizations: Repository<Organization>, users: Repository<User>, dataSource: DataSource, access: EquipmentAccessService, monitoring: MonitoringService, auditTrail: AuditTrailService);
    create(dto: CreateDeviceDto, actorId: string): Promise<{
        device: {
            id: string;
            name: string;
            location: string;
            organizationId: string;
            equipmentId: string | null;
            equipment: {
                id: string;
                name: string;
                type: import("../equipment/equipment.entity").EquipmentType;
                monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
                site: {
                    id: string;
                    name: string;
                } | null;
            } | null;
            deviceIdentifier: string;
            hardwareModel: string | null;
            firmwareVersion: string | null;
            lifecycleState: DeviceLifecycle;
            isActive: boolean;
            connectivity: string;
            currentStatus: string;
            lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
            lastReadingAt: Date | null;
            firstSeenAt: Date | null;
            lastSeenAt: Date | null;
            heartbeatIntervalSeconds: number;
            offlineTimeoutSeconds: number;
            provisionedAt: Date | null;
            rotatedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        apiKey: string;
        provisioning: {
            endpoint: string;
            heartbeatEndpoint: string;
            authorization: string;
            deviceIdentifier: string;
            heartbeatIntervalSeconds: number;
            offlineTimeoutSeconds: number;
            requiresHttpsInProduction: boolean;
        };
    }>;
    replace(id: string, dto: ReplaceDeviceDto, actorId: string): Promise<{
        device: {
            id: string;
            name: string;
            location: string;
            organizationId: string;
            equipmentId: string | null;
            equipment: {
                id: string;
                name: string;
                type: import("../equipment/equipment.entity").EquipmentType;
                monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
                site: {
                    id: string;
                    name: string;
                } | null;
            } | null;
            deviceIdentifier: string;
            hardwareModel: string | null;
            firmwareVersion: string | null;
            lifecycleState: DeviceLifecycle;
            isActive: boolean;
            connectivity: string;
            currentStatus: string;
            lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
            lastReadingAt: Date | null;
            firstSeenAt: Date | null;
            lastSeenAt: Date | null;
            heartbeatIntervalSeconds: number;
            offlineTimeoutSeconds: number;
            provisionedAt: Date | null;
            rotatedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        apiKey: string;
        provisioning: {
            endpoint: string;
            heartbeatEndpoint: string;
            authorization: string;
            deviceIdentifier: string;
            heartbeatIntervalSeconds: number;
            offlineTimeoutSeconds: number;
            requiresHttpsInProduction: boolean;
        };
    }>;
    findAll(userId: string): Promise<{
        id: string;
        name: string;
        location: string;
        organizationId: string;
        equipmentId: string | null;
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
            site: {
                id: string;
                name: string;
            } | null;
        } | null;
        deviceIdentifier: string;
        hardwareModel: string | null;
        firmwareVersion: string | null;
        lifecycleState: DeviceLifecycle;
        isActive: boolean;
        connectivity: string;
        currentStatus: string;
        lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
        lastReadingAt: Date | null;
        firstSeenAt: Date | null;
        lastSeenAt: Date | null;
        heartbeatIntervalSeconds: number;
        offlineTimeoutSeconds: number;
        provisionedAt: Date | null;
        rotatedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    findOne(id: string, userId: string): Promise<{
        id: string;
        name: string;
        location: string;
        organizationId: string;
        equipmentId: string | null;
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
            site: {
                id: string;
                name: string;
            } | null;
        } | null;
        deviceIdentifier: string;
        hardwareModel: string | null;
        firmwareVersion: string | null;
        lifecycleState: DeviceLifecycle;
        isActive: boolean;
        connectivity: string;
        currentStatus: string;
        lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
        lastReadingAt: Date | null;
        firstSeenAt: Date | null;
        lastSeenAt: Date | null;
        heartbeatIntervalSeconds: number;
        offlineTimeoutSeconds: number;
        provisionedAt: Date | null;
        rotatedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, dto: UpdateDeviceDto, actorId: string): Promise<{
        id: string;
        name: string;
        location: string;
        organizationId: string;
        equipmentId: string | null;
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
            site: {
                id: string;
                name: string;
            } | null;
        } | null;
        deviceIdentifier: string;
        hardwareModel: string | null;
        firmwareVersion: string | null;
        lifecycleState: DeviceLifecycle;
        isActive: boolean;
        connectivity: string;
        currentStatus: string;
        lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
        lastReadingAt: Date | null;
        firstSeenAt: Date | null;
        lastSeenAt: Date | null;
        heartbeatIntervalSeconds: number;
        offlineTimeoutSeconds: number;
        provisionedAt: Date | null;
        rotatedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    setLifecycle(id: string, state: DeviceLifecycle, actorId: string): Promise<{
        id: string;
        name: string;
        location: string;
        organizationId: string;
        equipmentId: string | null;
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
            site: {
                id: string;
                name: string;
            } | null;
        } | null;
        deviceIdentifier: string;
        hardwareModel: string | null;
        firmwareVersion: string | null;
        lifecycleState: DeviceLifecycle;
        isActive: boolean;
        connectivity: string;
        currentStatus: string;
        lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
        lastReadingAt: Date | null;
        firstSeenAt: Date | null;
        lastSeenAt: Date | null;
        heartbeatIntervalSeconds: number;
        offlineTimeoutSeconds: number;
        provisionedAt: Date | null;
        rotatedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    rotateKey(id: string, actorId: string): Promise<{
        device: {
            id: string;
            name: string;
            location: string;
            organizationId: string;
            equipmentId: string | null;
            equipment: {
                id: string;
                name: string;
                type: import("../equipment/equipment.entity").EquipmentType;
                monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
                site: {
                    id: string;
                    name: string;
                } | null;
            } | null;
            deviceIdentifier: string;
            hardwareModel: string | null;
            firmwareVersion: string | null;
            lifecycleState: DeviceLifecycle;
            isActive: boolean;
            connectivity: string;
            currentStatus: string;
            lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
            lastReadingAt: Date | null;
            firstSeenAt: Date | null;
            lastSeenAt: Date | null;
            heartbeatIntervalSeconds: number;
            offlineTimeoutSeconds: number;
            provisionedAt: Date | null;
            rotatedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
        apiKey: string;
        provisioning: {
            endpoint: string;
            heartbeatEndpoint: string;
            authorization: string;
            deviceIdentifier: string;
            heartbeatIntervalSeconds: number;
            offlineTimeoutSeconds: number;
            requiresHttpsInProduction: boolean;
        };
    }>;
    private safe;
    private provisioning;
    private enrollable;
    private validateIntervals;
    private getEntity;
    private assertAdmin;
}
