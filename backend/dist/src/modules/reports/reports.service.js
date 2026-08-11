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
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const device_entity_1 = require("../devices/device.entity");
const sensor_log_entity_1 = require("../sensors/sensor-log.entity");
const user_entity_1 = require("../users/user.entity");
let ReportsService = class ReportsService {
    usersRepository;
    devicesRepository;
    sensorLogsRepository;
    constructor(usersRepository, devicesRepository, sensorLogsRepository) {
        this.usersRepository = usersRepository;
        this.devicesRepository = devicesRepository;
        this.sensorLogsRepository = sensorLogsRepository;
    }
    async getDeviceUptime(userId, deviceId, from, to) {
        const { fromDate, toDate } = this.parseRange(from, to);
        const device = await this.ensureDeviceAccess(userId, deviceId);
        const segments = await this.buildSegments(device.id, fromDate, toDate);
        const summary = this.summarizeSegments(segments, fromDate, toDate);
        return {
            device: { id: device.id, name: device.name },
            period: { from: fromDate.toISOString(), to: toDate.toISOString() },
            summary,
            table: segments,
        };
    }
    async getDeviceDaily(userId, deviceId, from, to) {
        const { fromDate, toDate } = this.parseRange(from, to);
        await this.ensureDeviceAccess(userId, deviceId);
        const segments = await this.buildSegments(deviceId, fromDate, toDate);
        return this.toDailyBreakdown(segments, fromDate, toDate);
    }
    async getDeviceEvents(userId, deviceId, from, to) {
        const { fromDate, toDate } = this.parseRange(from, to);
        await this.ensureDeviceAccess(userId, deviceId);
        const logs = await this.sensorLogsRepository.find({
            where: { deviceId, recordedAt: (0, typeorm_2.Between)(fromDate, toDate) },
            order: { recordedAt: 'ASC' },
        });
        const events = [];
        let prev = null;
        for (const log of logs) {
            if (prev === null) {
                prev = log.status;
                events.push({
                    timestamp: log.recordedAt.toISOString(),
                    status: log.status,
                    transition: null,
                });
                continue;
            }
            const transition = prev === log.status ? null : `${prev}->${log.status}`;
            events.push({
                timestamp: log.recordedAt.toISOString(),
                status: log.status,
                transition,
            });
            prev = log.status;
        }
        return {
            deviceId,
            period: { from: fromDate.toISOString(), to: toDate.toISOString() },
            count: events.length,
            events,
        };
    }
    async getFleetSummary(userId, from, to) {
        const { fromDate, toDate } = this.parseRange(from, to);
        const deviceIds = await this.resolveAccessibleDeviceIds(userId);
        if (deviceIds.length === 0) {
            return {
                period: { from: fromDate.toISOString(), to: toDate.toISOString() },
                totals: { devices: 0, uptimeSeconds: 0, downtimeSeconds: 0, uptimePercentage: 0 },
                devices: [],
            };
        }
        const devices = await this.devicesRepository.findBy({ id: (0, typeorm_2.In)(deviceIds) });
        const rows = [];
        let totalUp = 0;
        let totalDown = 0;
        for (const device of devices) {
            const segments = await this.buildSegments(device.id, fromDate, toDate);
            const summary = this.summarizeSegments(segments, fromDate, toDate);
            totalUp += summary.uptimeSeconds;
            totalDown += summary.downtimeSeconds;
            rows.push({
                device: { id: device.id, name: device.name },
                ...summary,
            });
        }
        const denom = totalUp + totalDown;
        return {
            period: { from: fromDate.toISOString(), to: toDate.toISOString() },
            totals: {
                devices: rows.length,
                uptimeSeconds: totalUp,
                downtimeSeconds: totalDown,
                uptimePercentage: denom > 0 ? Number(((totalUp / denom) * 100).toFixed(2)) : 0,
            },
            devices: rows,
        };
    }
    parseRange(from, to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
            throw new common_1.BadRequestException('Invalid from/to date range');
        }
        if (toDate <= fromDate) {
            throw new common_1.BadRequestException('"to" must be greater than "from"');
        }
        return { fromDate, toDate };
    }
    async ensureDeviceAccess(userId, deviceId) {
        const device = await this.devicesRepository.findOne({ where: { id: deviceId } });
        if (!device)
            throw new common_1.NotFoundException('Device not found');
        const allowed = await this.resolveAccessibleDeviceIds(userId);
        if (!allowed.includes(deviceId)) {
            throw new common_1.ForbiddenException('You do not have access to this device');
        }
        return device;
    }
    async resolveAccessibleDeviceIds(userId) {
        const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['devices'] });
        if (!user)
            return [];
        if (user.role === user_role_enum_1.UserRole.ADMIN) {
            const all = await this.devicesRepository.find({ select: { id: true } });
            return all.map((d) => d.id);
        }
        return (user.devices ?? []).map((d) => d.id);
    }
    async buildSegments(deviceId, fromDate, toDate) {
        const prevLog = await this.sensorLogsRepository.findOne({
            where: { deviceId, recordedAt: (0, typeorm_2.LessThan)(fromDate) },
            order: { recordedAt: 'DESC' },
        });
        const logs = await this.sensorLogsRepository.find({
            where: { deviceId, recordedAt: (0, typeorm_2.Between)(fromDate, toDate) },
            order: { recordedAt: 'ASC' },
        });
        let currentStatus = prevLog?.status ?? 'OFF';
        let cursor = fromDate;
        const segments = [];
        for (const log of logs) {
            if (log.recordedAt <= cursor) {
                currentStatus = log.status;
                continue;
            }
            segments.push(this.makeSegment(cursor, log.recordedAt, currentStatus));
            currentStatus = log.status;
            cursor = log.recordedAt;
        }
        if (cursor < toDate) {
            segments.push(this.makeSegment(cursor, toDate, currentStatus));
        }
        return segments;
    }
    makeSegment(start, end, status) {
        const seconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
        return {
            start: start.toISOString(),
            end: end.toISOString(),
            durationMinutes: Math.floor(seconds / 60),
            type: status === 'ON' ? 'UPTIME' : 'DOWNTIME',
        };
    }
    summarizeSegments(segments, fromDate, toDate) {
        const uptimeSeconds = segments
            .filter((s) => s.type === 'UPTIME')
            .reduce((sum, s) => sum + s.durationMinutes * 60, 0);
        const downtimeSeconds = segments
            .filter((s) => s.type === 'DOWNTIME')
            .reduce((sum, s) => sum + s.durationMinutes * 60, 0);
        const rangeSeconds = Math.floor((toDate.getTime() - fromDate.getTime()) / 1000);
        const uptimePercentage = rangeSeconds > 0 ? Number(((uptimeSeconds / rangeSeconds) * 100).toFixed(2)) : 0;
        return {
            uptimeSeconds,
            downtimeSeconds,
            uptimePercentage,
        };
    }
    toDailyBreakdown(segments, fromDate, toDate) {
        const days = {};
        const cursor = new Date(fromDate);
        cursor.setUTCHours(0, 0, 0, 0);
        const endDay = new Date(toDate);
        endDay.setUTCHours(0, 0, 0, 0);
        while (cursor <= endDay) {
            const key = cursor.toISOString().slice(0, 10);
            days[key] = { uptimeSeconds: 0, downtimeSeconds: 0 };
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        for (const seg of segments) {
            let start = new Date(seg.start);
            const end = new Date(seg.end);
            while (start < end) {
                const dayKey = start.toISOString().slice(0, 10);
                const nextDay = new Date(start);
                nextDay.setUTCHours(24, 0, 0, 0);
                const sliceEnd = end < nextDay ? end : nextDay;
                const sliceSeconds = Math.floor((sliceEnd.getTime() - start.getTime()) / 1000);
                if (days[dayKey]) {
                    if (seg.type === 'UPTIME')
                        days[dayKey].uptimeSeconds += sliceSeconds;
                    else
                        days[dayKey].downtimeSeconds += sliceSeconds;
                }
                start = sliceEnd;
            }
        }
        return Object.entries(days).map(([day, values]) => {
            const total = values.uptimeSeconds + values.downtimeSeconds;
            return {
                day,
                uptimeSeconds: values.uptimeSeconds,
                downtimeSeconds: values.downtimeSeconds,
                uptimePercentage: total > 0 ? Number(((values.uptimeSeconds / total) * 100).toFixed(2)) : 0,
            };
        });
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(device_entity_1.Device)),
    __param(2, (0, typeorm_1.InjectRepository)(sensor_log_entity_1.SensorLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map