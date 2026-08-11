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
exports.SensorLog = void 0;
const typeorm_1 = require("typeorm");
const device_entity_1 = require("../devices/device.entity");
const sensor_status_enum_1 = require("../../common/enums/sensor-status.enum");
let SensorLog = class SensorLog {
    id;
    deviceId;
    device;
    status;
    recordedAt;
};
exports.SensorLog = SensorLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SensorLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'device_id', type: 'uuid' }),
    __metadata("design:type", String)
], SensorLog.prototype, "deviceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => device_entity_1.Device, (device) => device.sensorLogs, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'device_id' }),
    __metadata("design:type", device_entity_1.Device)
], SensorLog.prototype, "device", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: sensor_status_enum_1.SensorStatus,
    }),
    __metadata("design:type", String)
], SensorLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recorded_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], SensorLog.prototype, "recordedAt", void 0);
exports.SensorLog = SensorLog = __decorate([
    (0, typeorm_1.Entity)('sensor_logs')
], SensorLog);
//# sourceMappingURL=sensor-log.entity.js.map