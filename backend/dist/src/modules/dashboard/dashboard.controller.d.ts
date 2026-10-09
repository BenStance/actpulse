import { DashboardService } from './dashboard.service';
import type { DashboardFilters } from './dashboard.service';
import { AdminDashboardService } from './admin-dashboard.service';
export declare class DashboardController {
    private readonly dashboard;
    private readonly adminDashboard;
    constructor(dashboard: DashboardService, adminDashboard: AdminDashboardService);
    admin(req: {
        user: {
            sub: string;
        };
    }, filters: DashboardFilters & {
        currency?: string;
        orgPage?: string;
        equipmentPage?: string;
        pageSize?: string;
    }): Promise<{
        generatedAt: Date;
        filters: {
            from: Date;
            to: Date;
            timezone: string;
            organizationId: string | null;
            siteId: string | null;
            currency: string | null;
            preset?: string;
            orgPage?: string;
            equipmentPage?: string;
            pageSize?: string;
        };
        scope: {
            financial: string;
            operational: string;
        };
        definitions: {
            snapshot: string;
            period: string;
            collected: string;
            trialConversion: string;
            approachingLimits: string;
        };
        snapshot: {
            organizations: number;
            states: {
                ACTIVE: number;
                TRIALING: number;
                GRACE: number;
                EXPIRED: number;
                SUSPENDED: number;
                NONE: number;
                INACTIVE: number;
            };
            approachingLimits: number;
            pendingReviews: number;
            openAlerts: number;
            criticalAlerts: number;
            equipment: {
                total: number;
                generators: number;
                ups: number;
                on: number;
                off: number;
                unknown: number;
                online: number;
                offline: number;
                neverConnected: number;
            };
        };
        customers: {
            period: {
                [x: string]: unknown;
            };
            growth: {
                [x: string]: unknown;
            }[];
            byPlan: {
                plan: string;
                count: number;
            }[];
            byCycle: {
                cycle: string;
                count: number;
            }[];
            trialConversion: {
                cohort: number;
                converted: number;
                incompleteFollowUp: number;
            };
            upcoming: ({
                [x: string]: unknown;
            } & {
                id: string;
                name: string;
                administrative_status: string;
                subscription_status: string;
                plan_snapshot: {
                    code: string;
                    siteLimit: number;
                    equipmentLimit: number;
                    controllerLimit: number;
                } | null;
                billing_cycle: string | null;
                access_ends_at: Date | null;
                covered_after_end: boolean;
                sites: number;
                equipment: number;
                controllers: number;
                outstanding_by_currency: Array<{
                    currency: string;
                    amount: string;
                }>;
                pending_payments: number;
            })[];
            upcomingTimeline: {
                organizationId: string;
                organizationName: string;
                endsAt: Date | null;
                kind: string;
            }[];
            organizations: {
                items: ({
                    [x: string]: unknown;
                } & {
                    id: string;
                    name: string;
                    administrative_status: string;
                    subscription_status: string;
                    plan_snapshot: {
                        code: string;
                        siteLimit: number;
                        equipmentLimit: number;
                        controllerLimit: number;
                    } | null;
                    billing_cycle: string | null;
                    access_ends_at: Date | null;
                    covered_after_end: boolean;
                    sites: number;
                    equipment: number;
                    controllers: number;
                    outstanding_by_currency: Array<{
                        currency: string;
                        amount: string;
                    }>;
                    pending_payments: number;
                })[];
                total: number;
                page: number;
                pageSize: number;
            };
        };
        billing: {
            money: {
                [x: string]: unknown;
            }[];
            trend: {
                [x: string]: unknown;
            }[];
            methods: {
                [x: string]: unknown;
            }[];
            invoiceStates: {
                [x: string]: unknown;
            }[];
            ageing: {
                [x: string]: unknown;
            }[];
            paymentQueue: {
                [x: string]: unknown;
            }[];
            overdueInvoices: {
                [x: string]: unknown;
            }[];
            outstandingByOrganization: {
                organizationId: string;
                organizationName: string;
                currency: string;
                amount: string;
            }[];
        };
        operations: {
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
            period: {
                engineRunningEquipmentHours: number;
                outputPoweredEquipmentHours: number;
                knownOffEquipmentHours: number;
                unknownEquipmentHours: number;
                dataCoverage: number | null;
                completedObservedOnSessions: number;
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
            siteHours: {
                site: string;
                onHours: number;
                offHours: number;
                unknownHours: number;
            }[];
            equipmentHours: {
                equipmentId: string;
                equipment: string;
                onHours: number;
            }[];
            equipment: {
                items: {
                    organizationName: string;
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
                total: number;
                page: number;
                pageSize: number;
            };
            fuel: {
                purchasedLitres: {};
                apparentUsageLitres: string;
                estimatedLitres: string;
                costs: {
                    [x: string]: unknown;
                }[];
                draftReconciliations: {};
                flaggedReconciliations: {};
                trend: {
                    day: string;
                    currency: string;
                    amount: string;
                    litres: string;
                }[];
            };
            maintenance: {
                due: number;
                overdue: number;
                dueSoon: number;
                unableToDetermine: number;
                upcoming: {
                    id: string;
                    equipmentId: string;
                    title: string;
                    state: string;
                    nextDueAt: Date | null;
                }[];
                completed: {};
                costs: {
                    [x: string]: unknown;
                }[];
            };
            alerts: {
                criticalList: {
                    [x: string]: unknown;
                }[];
                groups: {
                    [x: string]: unknown;
                }[];
            };
            recentServices: {
                [x: string]: unknown;
            }[];
            fuelSpendingByLocation: {
                [x: string]: unknown;
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
        };
        activity: {
            [x: string]: unknown;
        }[];
    }>;
    overview(req: {
        user: {
            sub: string;
        };
    }, filters: DashboardFilters): Promise<{
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
    summary(req: {
        user: {
            sub: string;
        };
    }, filters: DashboardFilters): Promise<{
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
    }>;
    uptime(req: {
        user: {
            sub: string;
        };
    }, filters: DashboardFilters): Promise<{
        dataCoverage: number | null;
        day: string;
        onMs: number;
        offMs: number;
        unknownMs: number;
        eligibleMs: number;
        observedOnSessionCount: number;
    }[]>;
    downtime(req: {
        user: {
            sub: string;
        };
    }, filters: DashboardFilters): Promise<{
        dataCoverage: number | null;
        day: string;
        onMs: number;
        offMs: number;
        unknownMs: number;
        eligibleMs: number;
        observedOnSessionCount: number;
    }[]>;
    activity(req: {
        user: {
            sub: string;
        };
    }, filters: DashboardFilters): Promise<({
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
    })[]>;
}
