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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sensor_status_enum_1 = require("../../common/enums/sensor-status.enum");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const device_entity_1 = require("../devices/device.entity");
const sensor_log_entity_1 = require("../sensors/sensor-log.entity");
const user_entity_1 = require("../users/user.entity");
let DashboardService = class DashboardService {
    usersRepository;
    devicesRepository;
    sensorLogsRepository;
    constructor(usersRepository, devicesRepository, sensorLogsRepository) {
        this.usersRepository = usersRepository;
        this.devicesRepository = devicesRepository;
        this.sensorLogsRepository = sensorLogsRepository;
    }
    async getSummary(userId) {
        const deviceIds = await this.resolveDeviceIds(userId);
        if (deviceIds.length === 0) {
            return {
                totalDevices: 0,
                activeDevices: 0,
                onlineDevices: 0,
                onCount: 0,
                offCount: 0,
            };
        }
        const [totalDevices, activeDevices] = await Promise.all([
            this.devicesRepository.count({ where: { id: (0, typeorm_2.In)(deviceIds) } }),
            this.devicesRepository.count({ where: { id: (0, typeorm_2.In)(deviceIds), isActive: true } }),
        ]);
        const logs = await this.sensorLogsRepository.find({
            where: { deviceId: (0, typeorm_2.In)(deviceIds) },
            order: { recordedAt: 'DESC' },
        });
        const latestByDevice = new Map();
        for (const log of logs) {
            if (!latestByDevice.has(log.deviceId)) {
                latestByDevice.set(log.deviceId, log.status);
            }
        }
        const latestStatuses = [...latestByDevice.values()];
        const onCount = latestStatuses.filter((status) => status === sensor_status_enum_1.SensorStatus.ON).length;
        const offCount = latestStatuses.filter((status) => status === sensor_status_enum_1.SensorStatus.OFF).length;
        return {
            totalDevices,
            activeDevices,
            onlineDevices: latestStatuses.length,
            onCount,
            offCount,
        };
    }
    async getUptime(userId) {
        const logs = await this.getRecentLogs(userId);
        return this.toDailySeries(logs, sensor_status_enum_1.SensorStatus.ON, 'uptimeEvents');
    }
    async getDowntime(userId) {
        const logs = await this.getRecentLogs(userId);
        return this.toDailySeries(logs, sensor_status_enum_1.SensorStatus.OFF, 'downtimeEvents');
    }
    async getActivity(userId) {
        const deviceIds = await this.resolveDeviceIds(userId);
        if (deviceIds.length === 0)
            return [];
        const rows = await this.sensorLogsRepository.find({
            where: { deviceId: (0, typeorm_2.In)(deviceIds) },
            relations: ['device'],
            order: { recordedAt: 'DESC' },
            take: 50,
        });
        return rows.map((r) => ({
            id: r.id,
            deviceId: r.deviceId,
            deviceName: r.device?.name ?? 'Unknown',
            status: r.status,
            recordedAt: r.recordedAt,
        }));
    }
    async getRecentLogs(userId) {
        const deviceIds = await this.resolveDeviceIds(userId);
        if (deviceIds.length === 0)
            return [];
        const from = new Date();
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        return this.sensorLogsRepository.find({
            where: { deviceId: (0, typeorm_2.In)(deviceIds) },
            order: { recordedAt: 'ASC' },
        });
    }
    toDailySeries(logs, status, label) {
        const map = new Map();
        const today = new Date();
        const days = [];
        for (let i = 6; i >= 0; i -= 1) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            days.push(key);
            map.set(key, 0);
        }
        logs.forEach((log) => {
            if (log.status !== status)
                return;
            const key = log.recordedAt.toISOString().slice(0, 10);
            if (map.has(key)) {
                map.set(key, (map.get(key) ?? 0) + 1);
            }
        });
        return days.map((day) => ({ day, [label]: map.get(day) ?? 0 }));
    }
    async resolveDeviceIds(userId) {
        const user = await this.usersRepository.findOne({
            where: { id: userId },
            relations: ['devices'],
        });
        if (!user)
            return [];
        if (user.role === user_role_enum_1.UserRole.ADMIN) {
            const all = await this.devicesRepository.find({ select: { id: true } });
            return all.map((d) => d.id);
        }
        return (user.devices ?? []).map((d) => d.id);
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(device_entity_1.Device)),
    __param(2, (0, typeorm_1.InjectRepository)(sensor_log_entity_1.SensorLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map