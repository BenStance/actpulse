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
exports.SensorsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const sensor_log_entity_1 = require("./sensor-log.entity");
let SensorsService = class SensorsService {
    sensorLogRepository;
    realtimeGateway;
    heartbeatTimers = new Map();
    constructor(sensorLogRepository, realtimeGateway) {
        this.sensorLogRepository = sensorLogRepository;
        this.realtimeGateway = realtimeGateway;
    }
    async pushStatus(device, dto) {
        const lastLog = await this.sensorLogRepository.findOne({
            where: { deviceId: device.id },
            order: { recordedAt: 'DESC' },
        });
        if (lastLog?.status === dto.status) {
            return { message: 'Duplicate state ignored' };
        }
        const recordedAt = dto.timestamp ? new Date(dto.timestamp * 1000) : new Date();
        const entry = this.sensorLogRepository.create({
            deviceId: device.id,
            status: dto.status,
            recordedAt,
        });
        const saved = await this.sensorLogRepository.save(entry);
        const userIds = (device.users ?? []).map((u) => u.id);
        this.realtimeGateway.emitDeviceStatusUpdated(device.id, dto.status, saved.recordedAt, userIds);
        return { message: 'Status accepted', logId: saved.id };
    }
    heartbeat(device) {
        this.realtimeGateway.emitDeviceOnline(device.id);
        const existing = this.heartbeatTimers.get(device.id);
        if (existing)
            clearTimeout(existing);
        const timer = setTimeout(() => {
            this.realtimeGateway.emitDeviceOffline(device.id);
            this.heartbeatTimers.delete(device.id);
        }, 120000);
        this.heartbeatTimers.set(device.id, timer);
        return { message: 'Heartbeat accepted' };
    }
};
exports.SensorsService = SensorsService;
exports.SensorsService = SensorsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sensor_log_entity_1.SensorLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        realtime_gateway_1.RealtimeGateway])
], SensorsService);
//# sourceMappingURL=sensors.service.js.map