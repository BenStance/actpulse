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
exports.DevicesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const sensor_log_entity_1 = require("../sensors/sensor-log.entity");
const user_entity_1 = require("../users/user.entity");
const device_entity_1 = require("./device.entity");
let DevicesService = class DevicesService {
    devicesRepository;
    sensorLogsRepository;
    usersRepository;
    constructor(devicesRepository, sensorLogsRepository, usersRepository) {
        this.devicesRepository = devicesRepository;
        this.sensorLogsRepository = sensorLogsRepository;
        this.usersRepository = usersRepository;
    }
    create(dto) {
        const device = this.devicesRepository.create({
            ...dto,
            apiKey: this.generateApiKey(),
            isActive: true,
        });
        return this.devicesRepository.save(device);
    }
    async findAll(userId) {
        const allowedIds = await this.resolveAccessibleDeviceIds(userId);
        const devices = allowedIds.length
            ? await this.devicesRepository.find({ where: { id: (0, typeorm_2.In)(allowedIds) }, relations: ['users'] })
            : [];
        return this.attachCurrentStatus(devices);
    }
    async findOne(id, userId) {
        await this.assertDeviceAccess(userId, id);
        const device = await this.devicesRepository.findOne({ where: { id }, relations: ['users'] });
        if (!device)
            throw new common_1.NotFoundException('Device not found');
        const [withStatus] = await this.attachCurrentStatus([device]);
        return withStatus;
    }
    async update(id, dto, userId) {
        const device = await this.findOne(id, userId);
        Object.assign(device, dto);
        await this.devicesRepository.save(device);
        return this.findOne(id, userId);
    }
    async deactivate(id, userId) {
        const device = await this.findOne(id, userId);
        device.isActive = false;
        await this.devicesRepository.save(device);
        return { message: 'Device deactivated successfully' };
    }
    async rotateKey(id, userId) {
        const device = await this.findOne(id, userId);
        device.apiKey = this.generateApiKey();
        await this.devicesRepository.save(device);
        return { id: device.id, apiKey: device.apiKey };
    }
    generateApiKey() {
        return (0, crypto_1.randomBytes)(24).toString('hex');
    }
    async attachCurrentStatus(devices) {
        if (devices.length === 0)
            return [];
        const deviceIds = devices.map((d) => d.id);
        const logs = await this.sensorLogsRepository.find({
            where: { deviceId: (0, typeorm_2.In)(deviceIds) },
            order: { recordedAt: 'DESC' },
        });
        const latestByDevice = new Map();
        for (const log of logs) {
            if (!latestByDevice.has(log.deviceId)) {
                latestByDevice.set(log.deviceId, log);
            }
        }
        return devices.map((device) => {
            const latest = latestByDevice.get(device.id);
            return {
                ...device,
                currentStatus: latest?.status ?? 'UNKNOWN',
                lastReadingAt: latest?.recordedAt ?? null,
            };
        });
    }
    async resolveAccessibleDeviceIds(userId) {
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
    async assertDeviceAccess(userId, deviceId) {
        const allowedIds = await this.resolveAccessibleDeviceIds(userId);
        if (!allowedIds.includes(deviceId)) {
            throw new common_1.ForbiddenException('You do not have access to this device');
        }
    }
};
exports.DevicesService = DevicesService;
exports.DevicesService = DevicesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(device_entity_1.Device)),
    __param(1, (0, typeorm_1.InjectRepository)(sensor_log_entity_1.SensorLog)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DevicesService);
//# sourceMappingURL=devices.service.js.map