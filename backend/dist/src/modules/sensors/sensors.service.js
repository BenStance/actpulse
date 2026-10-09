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
const device_entity_1 = require("../devices/device.entity");
const connectivity_event_entity_1 = require("../monitoring/connectivity-event.entity");
const connectivity_service_1 = require("../monitoring/connectivity.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const sensor_log_entity_1 = require("./sensor-log.entity");
let SensorsService = class SensorsService {
    logs;
    dataSource;
    connectivity;
    realtime;
    constructor(logs, dataSource, connectivity, realtime) {
        this.logs = logs;
        this.dataSource = dataSource;
        this.connectivity = connectivity;
        this.realtime = realtime;
    }
    async pushStatus(device, dto, source = 'DEVICE') {
        if (!device.currentEquipmentId)
            throw new common_1.BadRequestException('Monitor is not bound to equipment');
        const now = new Date();
        const observedAt = this.observedAt(dto, now);
        let result;
        let connectionEvent = null;
        await this.dataSource.transaction(async (manager) => {
            const current = await manager.getRepository(device_entity_1.Device).findOne({
                where: { id: device.id },
                lock: { mode: 'pessimistic_write' },
            });
            if (!current?.currentEquipmentId ||
                !current.isActive ||
                current.lifecycleState !== device_entity_1.DeviceLifecycle.ACTIVE)
                throw new common_1.BadRequestException('Monitor is inactive or unbound');
            const latest = await manager.getRepository(sensor_log_entity_1.SensorLog).findOne({
                where: { deviceId: device.id },
                order: { recordedAt: 'DESC', id: 'DESC' },
            });
            if (dto.eventId) {
                const duplicate = await manager
                    .getRepository(sensor_log_entity_1.SensorLog)
                    .findOne({ where: { deviceId: device.id, eventId: dto.eventId } });
                if (duplicate) {
                    connectionEvent = await this.touch(manager, current, now);
                    result = {
                        message: 'Duplicate event ignored',
                        logId: duplicate.id,
                        kind: duplicate.kind,
                    };
                    return;
                }
            }
            if (latest && observedAt.getTime() < latest.recordedAt.getTime())
                throw new common_1.ConflictException('Out-of-order observation rejected');
            connectionEvent = await this.touch(manager, current, now);
            const kind = latest && latest.status === dto.status ? 'CONFIRMATION' : 'TRANSITION';
            const log = await manager.save(sensor_log_entity_1.SensorLog, manager.create(sensor_log_entity_1.SensorLog, {
                deviceId: device.id,
                equipmentId: current.currentEquipmentId,
                status: dto.status,
                recordedAt: observedAt,
                receivedAt: now,
                timestampBasis: dto.observedAt || dto.timestamp ? 'DEVICE' : 'RECEIVED',
                source,
                eventId: dto.eventId || null,
                kind,
            }));
            await manager.update(device_entity_1.Device, device.id, { lastStatusAt: now });
            result = { message: 'Status accepted', logId: log.id, kind };
        });
        const recipients = await this.connectivity.recipientIds(device.currentEquipmentId, device.organizationId);
        if (connectionEvent)
            this.realtime.emitMonitorConnectivity(device.id, device.currentEquipmentId, connectionEvent, now, recipients);
        if (result.message === 'Status accepted')
            this.realtime.emitEquipmentState(device.currentEquipmentId, dto.status, observedAt, device.id, result.kind, recipients);
        return result;
    }
    async heartbeat(device, dto) {
        if (dto.status)
            return this.pushStatus(device, {
                status: dto.status,
                timestamp: dto.timestamp,
            });
        const now = new Date();
        let event = null;
        await this.dataSource.transaction(async (manager) => {
            const current = await manager.getRepository(device_entity_1.Device).findOne({
                where: { id: device.id },
                lock: { mode: 'pessimistic_write' },
            });
            if (!current?.currentEquipmentId ||
                !current.isActive ||
                current.lifecycleState !== device_entity_1.DeviceLifecycle.ACTIVE)
                throw new common_1.BadRequestException('Monitor is inactive or unbound');
            event = await this.touch(manager, current, now);
        });
        if (event) {
            const recipients = await this.connectivity.recipientIds(device.currentEquipmentId, device.organizationId);
            this.realtime.emitMonitorConnectivity(device.id, device.currentEquipmentId, event, now, recipients);
        }
        return {
            message: 'Heartbeat accepted',
            connectivity: 'ONLINE',
            equipmentStateConfirmed: false,
        };
    }
    observedAt(dto, receivedAt) {
        if (dto.observedAt && dto.timestamp)
            throw new common_1.BadRequestException('Use observedAt or legacy timestamp, not both');
        const observed = dto.observedAt
            ? new Date(dto.observedAt)
            : dto.timestamp
                ? new Date(dto.timestamp * 1000)
                : receivedAt;
        if (!Number.isFinite(observed.getTime()) ||
            observed.getTime() > receivedAt.getTime() + 300000 ||
            observed.getTime() < receivedAt.getTime() - 300000)
            throw new common_1.BadRequestException('Observation timestamp must be within five minutes of server receipt');
        return observed;
    }
    async touch(manager, device, now) {
        const wasNever = !device.firstSeenAt;
        const wasOffline = device.connectivityState !== device_entity_1.ConnectivityState.ONLINE ||
            !device.lastSeenAt ||
            now.getTime() - device.lastSeenAt.getTime() >
                device.offlineTimeoutSeconds * 1000;
        const event = wasNever ? 'FIRST_CONTACT' : wasOffline ? 'ONLINE' : null;
        await manager.update(device_entity_1.Device, device.id, {
            firstSeenAt: device.firstSeenAt ?? now,
            lastSeenAt: now,
            connectivityState: device_entity_1.ConnectivityState.ONLINE,
            connectedSinceAt: wasOffline ? now : device.connectedSinceAt,
        });
        if (event)
            await manager.save(connectivity_event_entity_1.ConnectivityEvent, manager.create(connectivity_event_entity_1.ConnectivityEvent, {
                deviceId: device.id,
                equipmentId: device.currentEquipmentId,
                type: event,
                occurredAt: now,
            }));
        return event;
    }
};
exports.SensorsService = SensorsService;
exports.SensorsService = SensorsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sensor_log_entity_1.SensorLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource,
        connectivity_service_1.ConnectivityService,
        realtime_gateway_1.RealtimeGateway])
], SensorsService);
//# sourceMappingURL=sensors.service.js.map