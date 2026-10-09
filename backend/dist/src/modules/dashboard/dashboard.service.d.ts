import { MonitoringService, PeriodOptions } from '../monitoring/monitoring.service';
import { OperationalDashboardService } from '../operations/operational-dashboard.service';
export type DashboardFilters = PeriodOptions & {
    organizationId?: string;
    siteId?: string;
    type?: string;
    equipmentId?: string;
    active?: boolean;
};
export declare class DashboardService {
    private readonly monitoring;
    private readonly operations;
    constructor(monitoring: MonitoringService, operations: OperationalDashboardService);
    overview(userId: string, filters?: DashboardFilters): Promise<{
        period: {
            from: Date;
            to: Date;
            timezone: string;
        };
        summary: {
            totalEquipment: number;
            knownOn: number;
            knownOff: number;
            unknownState: number;
            onlineMonitors: number;
            offlineMonitors: number;
            neverConnectedMonitors: number;
            onEquipmentHours: number;
            offEquipmentHours: number;
            unknownEquipmentHours: number;
            onMs: number;
            offMs: number;
            unknownMs: number;
            eligibleMs: number;
            dataCoverage: number | null;
            onShareOfKnown: number | null;
        };
        daily: {
            dataCoverage: number | null;
            day: string;
            onMs: number;
            offMs: number;
            unknownMs: number;
            eligibleMs: number;
            observedOnSessionCount: number;
        }[];
        comparison: {
            equipmentId?: string | undefined;
            latestFuelReading?: {
                equipment_id: string;
                observed_at: Date;
                level_litres: string;
                source: string;
            } | null | undefined;
            maintenanceStatus?: string | null | undefined;
            openAlertCount?: number | undefined;
            estimate?: {
                estimatedLitres: string;
                eligibleMs: number;
                unknownMs: number;
                configuredMs: number;
                periodMs: number;
                coverage: number | null;
                unobservedMs: number;
                definition: import("../equipment/equipment.entity").MonitoringDefinition | null;
                limitation: string;
                intervals: {
                    from: Date;
                    to: Date;
                    basis: string;
                    litresPerHour: string;
                    observedOnMs: number;
                    unknownMs: number;
                    estimatedLitres: string;
                }[];
            } | null | undefined;
            apparentUsageLitres?: string | null | undefined;
            purchasedLitres?: string | undefined;
            id: string;
            name: string;
            type: import("../equipment/equipment.entity").EquipmentType;
            site: {
                id: string;
                name: string;
                timezone: string;
            };
            organizationId: string;
            monitoringDefinition: import("../equipment/equipment.entity").MonitoringDefinition | null;
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
            onMs: number;
            offMs: number;
            unknownMs: number;
            eligibleMs: number;
            knownMs: number;
            coverage: number | null;
            completedOnSessionCount: number;
            daily: {
                day: string;
                onMs: number;
                offMs: number;
                unknownMs: number;
                eligibleMs: number;
                dataCoverage: number | null;
                observedOnSessionCount: number;
            }[];
        }[];
        activity: ({
            equipmentId: string;
            equipmentName: string;
            id: string;
            type: string;
            status: import("../../common/enums/sensor-status.enum").SensorStatus;
            kind: "TRANSITION" | "CONFIRMATION";
            deviceId: string;
            at: Date;
            source: "DEVICE" | "SIMULATOR";
            timestampBasis: "RECEIVED" | "DEVICE";
        } | {
            equipmentId: string;
            equipmentName: string;
            id: string;
            type: string;
            status: "ONLINE" | "OFFLINE" | "FIRST_CONTACT";
            kind: null;
            deviceId: string;
            at: Date;
            source: null;
            timestampBasis: null;
        } | {
            id: string;
            type: string;
            status: string;
            kind: string;
            deviceId: null;
            at: Date;
            source: string;
            timestampBasis: null;
            equipmentId: string;
            equipmentName: string;
        })[];
        operational: {
            organizations: number;
            sites: number;
            purchasedLitres: string;
            apparentUsageLitres: string;
            estimatedLitres: string;
            spendingByCurrency: {
                currency: string;
                amount: string;
                litres: string;
            }[];
            maintenanceDue: number;
            maintenanceOverdue: number;
            maintenanceDueSoon: number;
            maintenanceUnable: number;
            openAlerts: number;
        };
        upcomingMaintenance: {
            id: string;
            equipmentId: string;
            title: string;
            state: string;
            nextDueAt: Date | null;
        }[];
        fuelSeries: {
            equipment_id: string;
            at: Date;
            level_litres: string;
            source: string;
        }[];
        refillMarkers: {
            equipment_id: string;
            at: Date;
            quantity_litres: string;
        }[];
        costTrend: {
            day: string;
            currency: string;
            amount: string;
            litres: string;
        }[];
    }>;
}
