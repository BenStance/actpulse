import { Repository } from 'typeorm';
import { Device } from '../devices/device.entity';
import { DeviceBinding } from '../devices/device-binding.entity';
import { EquipmentAccessService, MonitoringService, PeriodOptions } from '../monitoring/monitoring.service';
export type ReportFilters = PeriodOptions & {
    equipmentId?: string;
    deviceId?: string;
    organizationId?: string;
    siteId?: string;
    type?: string;
    page?: string;
    pageSize?: string;
};
export declare class ReportsService {
    private readonly devices;
    private readonly bindings;
    private readonly access;
    private readonly monitoring;
    constructor(devices: Repository<Device>, bindings: Repository<DeviceBinding>, access: EquipmentAccessService, monitoring: MonitoringService);
    private target;
    equipmentReport(userId: string, filters: ReportFilters): Promise<{
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            site: {
                id: string;
                name: string;
                timezone: string;
            };
            monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
        };
        period: {
            from: string;
            to: string;
        };
        timezone: string;
        summary: {
            onMs: number;
            offMs: number;
            unknownMs: number;
            knownMs: number;
            eligibleMs: number;
            excludedMs: number;
            dataCoverage: number | null;
            onShareOfKnown: number | null;
            observedOnSessionCount: number;
            completedOnSessionCount: number;
            averageCompletedOnSessionMs: number | null;
            longestCompletedOnSessionMs: number | null;
            currentObservedOnSessionMs: number | null;
            firstObservation: string | null;
            lastObservation: string | null;
        };
        daily: {
            day: string;
            onMs: number;
            offMs: number;
            unknownMs: number;
            eligibleMs: number;
            dataCoverage: number | null;
            observedOnSessionCount: number;
        }[];
        segments: import("../monitoring/duration-calculator").DurationSegment[];
        sessions: import("../monitoring/duration-calculator").ObservedSession[];
        snapshot: {
            state: string;
            confidence: string;
            lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
            lastConfirmedAt: Date | null;
            connectivity: string;
            lastSeenAt: null;
            firstSeenAt: null;
            monitor: null;
            currentObservedSessionMs: null;
        } | {
            state: string;
            confidence: string;
            lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
            lastConfirmedAt: Date | null;
            connectivity: import("../devices/device.entity").ConnectivityState;
            lastSeenAt: Date | null;
            firstSeenAt: Date | null;
            monitor: {
                id: string;
                name: string;
                deviceIdentifier: string;
                lifecycleState: import("../devices/device.entity").DeviceLifecycle;
                hardwareModel: string | null;
                firmwareVersion: string | null;
                offlineTimeoutSeconds: number;
            };
            currentObservedSessionMs: number | null;
        };
    }>;
    events(userId: string, filters: ReportFilters): Promise<{
        equipment: {
            id: string;
            name: string;
        };
        period: {
            from: Date;
            to: Date;
            timezone: string;
        };
        items: ({
            id: string;
            type: string;
            status: import("../../common/enums/sensor-status.enum").SensorStatus;
            kind: "TRANSITION" | "CONFIRMATION";
            deviceId: string;
            at: Date;
            source: "DEVICE" | "SIMULATOR";
            timestampBasis: "RECEIVED" | "DEVICE";
        } | {
            id: string;
            type: string;
            status: "ONLINE" | "OFFLINE" | "FIRST_CONTACT";
            kind: null;
            deviceId: string;
            at: Date;
            source: null;
            timestampBasis: null;
        })[];
        total: number;
        page: number;
        pageSize: number;
    }>;
    fleet(userId: string, filters: ReportFilters): Promise<{
        period: {
            from: Date;
            to: Date;
            timezone: string;
        };
        units: string;
        totals: {
            equipment: number;
            onMs: number;
            offMs: number;
            unknownMs: number;
            eligibleMs: number;
            dataCoverage: number | null;
            onShareOfKnown: number | null;
        };
        equipment: {
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            site: {
                id: string;
                name: string;
            };
            monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
            onMs: number;
            offMs: number;
            unknownMs: number;
            eligibleMs: number;
            knownMs: number;
            dataCoverage: number | null;
            completedOnSessionCount: number;
            averageCompletedOnSessionMs: number | null;
            longestCompletedOnSessionMs: number | null;
            snapshot: {
                state: string;
                confidence: string;
                lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
                lastConfirmedAt: Date | null;
                connectivity: string;
                lastSeenAt: null;
                firstSeenAt: null;
                monitor: null;
                currentObservedSessionMs: null;
            } | {
                state: string;
                confidence: string;
                lastKnownStatus: import("../../common/enums/sensor-status.enum").SensorStatus | null;
                lastConfirmedAt: Date | null;
                connectivity: import("../devices/device.entity").ConnectivityState;
                lastSeenAt: Date | null;
                firstSeenAt: Date | null;
                monitor: {
                    id: string;
                    name: string;
                    deviceIdentifier: string;
                    lifecycleState: import("../devices/device.entity").DeviceLifecycle;
                    hardwareModel: string | null;
                    firmwareVersion: string | null;
                    offlineTimeoutSeconds: number;
                };
                currentObservedSessionMs: number | null;
            };
        }[];
    }>;
    csv(userId: string, filters: ReportFilters): Promise<string>;
}
