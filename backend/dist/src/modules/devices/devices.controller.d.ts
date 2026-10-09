import { DeviceLifecycle } from './device.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ReplaceDeviceDto } from './dto/replace-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';
export declare class DevicesController {
    private readonly devices;
    constructor(devices: DevicesService);
    create(dto: CreateDeviceDto, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    list(req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    detail(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    update(id: string, dto: UpdateDeviceDto, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    rotate(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    replace(id: string, dto: ReplaceDeviceDto, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    activate(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    disable(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    retire(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
    legacyDisable(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
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
}
