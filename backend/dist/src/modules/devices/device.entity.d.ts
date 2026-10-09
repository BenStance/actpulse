import { User } from '../users/user.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { Organization } from '../organizations/organization.entity';
import { Equipment } from '../equipment/equipment.entity';
export declare enum DeviceLifecycle {
    UNPROVISIONED = "UNPROVISIONED",
    ACTIVE = "ACTIVE",
    DISABLED = "DISABLED",
    RETIRED = "RETIRED"
}
export declare enum ConnectivityState {
    NEVER_CONNECTED = "NEVER_CONNECTED",
    ONLINE = "ONLINE",
    OFFLINE = "OFFLINE"
}
export declare class Device {
    id: string;
    name: string;
    location: string;
    organizationId: string;
    organization: Organization;
    currentEquipmentId: string | null;
    equipment: Equipment | null;
    deviceIdentifier: string;
    hardwareModel: string | null;
    firmwareVersion: string | null;
    lifecycleState: DeviceLifecycle;
    credentialId: string | null;
    credentialHash: string | null;
    isActive: boolean;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    lastStatusAt: Date | null;
    connectedSinceAt: Date | null;
    connectivityState: ConnectivityState;
    heartbeatIntervalSeconds: number;
    offlineTimeoutSeconds: number;
    provisionedAt: Date | null;
    rotatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    sensorLogs: SensorLog[];
    users: User[];
}
