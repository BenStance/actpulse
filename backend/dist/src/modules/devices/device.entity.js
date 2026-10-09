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
exports.Device = exports.ConnectivityState = exports.DeviceLifecycle = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const sensor_log_entity_1 = require("../sensors/sensor-log.entity");
const organization_entity_1 = require("../organizations/organization.entity");
const equipment_entity_1 = require("../equipment/equipment.entity");
var DeviceLifecycle;
(function (DeviceLifecycle) {
    DeviceLifecycle["UNPROVISIONED"] = "UNPROVISIONED";
    DeviceLifecycle["ACTIVE"] = "ACTIVE";
    DeviceLifecycle["DISABLED"] = "DISABLED";
    DeviceLifecycle["RETIRED"] = "RETIRED";
})(DeviceLifecycle || (exports.DeviceLifecycle = DeviceLifecycle = {}));
var ConnectivityState;
(function (ConnectivityState) {
    ConnectivityState["NEVER_CONNECTED"] = "NEVER_CONNECTED";
    ConnectivityState["ONLINE"] = "ONLINE";
    ConnectivityState["OFFLINE"] = "OFFLINE";
})(ConnectivityState || (exports.ConnectivityState = ConnectivityState = {}));
let Device = class Device {
    id;
    name;
    location;
    organizationId;
    organization;
    currentEquipmentId;
    equipment;
    deviceIdentifier;
    hardwareModel;
    firmwareVersion;
    lifecycleState;
    credentialId;
    credentialHash;
    isActive;
    firstSeenAt;
    lastSeenAt;
    lastStatusAt;
    connectedSinceAt;
    connectivityState;
    heartbeatIntervalSeconds;
    offlineTimeoutSeconds;
    provisionedAt;
    rotatedAt;
    createdAt;
    updatedAt;
    sensorLogs;
    users;
};
exports.Device = Device;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Device.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Device.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Device.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Device.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, (organization) => organization.devices, {
        onDelete: 'RESTRICT',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Device.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'current_equipment_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "currentEquipmentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => equipment_entity_1.Equipment, (equipment) => equipment.monitors, {
        onDelete: 'RESTRICT',
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'current_equipment_id' }),
    __metadata("design:type", Object)
], Device.prototype, "equipment", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'device_identifier', unique: true }),
    __metadata("design:type", String)
], Device.prototype, "deviceIdentifier", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hardware_model', type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "hardwareModel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'firmware_version', type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "firmwareVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'lifecycle_state',
        type: 'varchar',
        default: DeviceLifecycle.ACTIVE,
    }),
    __metadata("design:type", String)
], Device.prototype, "lifecycleState", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'credential_id', type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "credentialId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'credential_hash', type: 'char', length: 64, nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "credentialHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Device.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'first_seen_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "firstSeenAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_seen_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "lastSeenAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_status_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "lastStatusAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'connected_since_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "connectedSinceAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'connectivity_state',
        type: 'varchar',
        default: ConnectivityState.NEVER_CONNECTED,
    }),
    __metadata("design:type", String)
], Device.prototype, "connectivityState", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'heartbeat_interval_seconds', default: 30 }),
    __metadata("design:type", Number)
], Device.prototype, "heartbeatIntervalSeconds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'offline_timeout_seconds', default: 120 }),
    __metadata("design:type", Number)
], Device.prototype, "offlineTimeoutSeconds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provisioned_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "provisionedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rotated_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Object)
], Device.prototype, "rotatedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Device.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Device.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => sensor_log_entity_1.SensorLog, (sensorLog) => sensorLog.device),
    __metadata("design:type", Array)
], Device.prototype, "sensorLogs", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => user_entity_1.User, (user) => user.devices),
    __metadata("design:type", Array)
], Device.prototype, "users", void 0);
exports.Device = Device = __decorate([
    (0, typeorm_1.Entity)('devices')
], Device);
//# sourceMappingURL=device.entity.js.map