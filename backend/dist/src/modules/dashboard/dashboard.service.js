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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const monitoring_service_1 = require("../monitoring/monitoring.service");
const operational_dashboard_service_1 = require("../operations/operational-dashboard.service");
let DashboardService = class DashboardService {
    monitoring;
    operations;
    constructor(monitoring, operations) {
        this.monitoring = monitoring;
        this.operations = operations;
    }
    async overview(userId, filters = {}) {
        const scoped = await this.monitoring.scopedEquipment(userId, {
            organizationId: filters.organizationId,
            siteId: filters.siteId,
            type: filters.type,
            active: filters.active,
        });
        const equipment = filters.equipmentId
            ? scoped.filter((row) => row.id === filters.equipmentId)
            : scoped;
        const zones = [...new Set(equipment.map((row) => row.site.timezone))];
        if (zones.length > 1 && !filters.timezone)
            throw new common_1.BadRequestException('Select a reporting timezone for multiple sites');
        const period = this.monitoring.resolvePeriod(filters, filters.timezone || zones[0] || 'Africa/Dar_es_Salaam');
        const rows = await Promise.all(equipment.map(async (row) => {
            const [snapshot, metrics] = await Promise.all([
                this.monitoring.snapshot(row),
                this.monitoring.metrics(row, period.from, period.to, period.timezone),
            ]);
            return {
                id: row.id,
                name: row.name,
                type: row.type,
                site: {
                    id: row.site.id,
                    name: row.site.name,
                    timezone: row.site.timezone,
                },
                organizationId: row.organizationId,
                monitoringDefinition: row.monitoringDefinition,
                snapshot,
                onMs: metrics.onMs,
                offMs: metrics.offMs,
                unknownMs: metrics.unknownMs,
                eligibleMs: metrics.eligibleMs,
                knownMs: metrics.knownMs,
                coverage: metrics.dataCoverage,
                completedOnSessionCount: metrics.completedOnSessionCount,
                daily: metrics.daily,
            };
        }));
        const total = (key) => rows.reduce((sum, row) => sum + row[key], 0);
        const eligibleMs = total('eligibleMs'), knownMs = total('knownMs'), onMs = total('onMs'), offMs = total('offMs'), unknownMs = total('unknownMs');
        const dailyMap = new Map();
        for (const row of rows)
            for (const item of row.daily) {
                const day = dailyMap.get(item.day) || {
                    day: item.day,
                    onMs: 0,
                    offMs: 0,
                    unknownMs: 0,
                    eligibleMs: 0,
                    observedOnSessionCount: 0,
                };
                day.onMs += item.onMs;
                day.offMs += item.offMs;
                day.unknownMs += item.unknownMs;
                day.eligibleMs += item.eligibleMs;
                day.observedOnSessionCount += item.observedOnSessionCount;
                dailyMap.set(item.day, day);
            }
        const daily = [...dailyMap.values()]
            .sort((a, b) => a.day.localeCompare(b.day))
            .map((day) => ({
            ...day,
            dataCoverage: day.eligibleMs
                ? (day.onMs + day.offMs) / day.eligibleMs
                : null,
        }));
        const recent = await Promise.all(equipment
            .slice(0, 20)
            .map((row) => this.monitoring.events(row.id, period.from, period.to, 1, 5)));
        const activity = recent
            .flatMap((result, index) => result.items.map((item) => ({
            ...item,
            equipmentId: equipment[index].id,
            equipmentName: equipment[index].name,
        })))
            .sort((a, b) => b.at.getTime() - a.at.getTime())
            .slice(0, 25);
        const operational = await this.operations.snapshot(userId, equipment.map((row) => row.id), period.from, period.to, period.timezone);
        const detailMap = new Map(operational.byEquipment.map((row) => [row.equipmentId, row]));
        return {
            period: { from: period.from, to: period.to, timezone: period.timezone },
            summary: {
                totalEquipment: rows.length,
                knownOn: rows.filter((row) => row.snapshot.state === 'ON').length,
                knownOff: rows.filter((row) => row.snapshot.state === 'OFF').length,
                unknownState: rows.filter((row) => row.snapshot.state === 'UNKNOWN')
                    .length,
                onlineMonitors: rows.filter((row) => row.snapshot.connectivity === 'ONLINE').length,
                offlineMonitors: rows.filter((row) => row.snapshot.connectivity === 'OFFLINE').length,
                neverConnectedMonitors: rows.filter((row) => row.snapshot.connectivity === 'NEVER_CONNECTED').length,
                onEquipmentHours: onMs / 3600000,
                offEquipmentHours: offMs / 3600000,
                unknownEquipmentHours: unknownMs / 3600000,
                onMs,
                offMs,
                unknownMs,
                eligibleMs,
                dataCoverage: eligibleMs ? knownMs / eligibleMs : null,
                onShareOfKnown: knownMs ? onMs / knownMs : null,
            },
            daily,
            comparison: rows.map((row) => ({ ...row, ...detailMap.get(row.id) })),
            activity: [
                ...activity,
                ...operational.activity.map((item) => ({
                    id: `${item.kind}-${item.equipment_id}-${new Date(item.at).getTime()}`,
                    type: 'OPERATION',
                    status: item.kind,
                    kind: item.label,
                    deviceId: null,
                    at: item.at,
                    source: item.label,
                    timestampBasis: null,
                    equipmentId: item.equipment_id,
                    equipmentName: equipment.find((row) => row.id === item.equipment_id)?.name ||
                        'Equipment',
                })),
            ]
                .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                .slice(0, 25),
            operational: operational.summary,
            upcomingMaintenance: operational.upcomingMaintenance,
            fuelSeries: operational.fuelSeries ?? [],
            refillMarkers: operational.refillMarkers ?? [],
            costTrend: operational.costTrend ?? [],
        };
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [monitoring_service_1.MonitoringService,
        operational_dashboard_service_1.OperationalDashboardService])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map