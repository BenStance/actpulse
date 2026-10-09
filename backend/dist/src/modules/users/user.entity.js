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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const device_entity_1 = require("../devices/device.entity");
const password_otp_entity_1 = require("../auth/password-otp.entity");
const organization_entity_1 = require("../organizations/organization.entity");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const equipment_entity_1 = require("../equipment/equipment.entity");
let User = class User {
    id;
    name;
    email;
    password;
    role;
    organizationId;
    organization;
    isActive;
    isActivated;
    tokenVersion;
    createdAt;
    updatedAt;
    devices;
    equipment;
    otps;
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization, (organization) => organization.users, {
        nullable: true,
        onDelete: 'RESTRICT',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Object)
], User.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_activated', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "isActivated", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_version', default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "tokenVersion", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => device_entity_1.Device, (device) => device.users),
    (0, typeorm_1.JoinTable)({
        name: 'user_devices',
        joinColumn: { name: 'user_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'device_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], User.prototype, "devices", void 0);
__decorate([
    (0, typeorm_1.ManyToMany)(() => equipment_entity_1.Equipment, (equipment) => equipment.users),
    (0, typeorm_1.JoinTable)({
        name: 'user_equipment',
        joinColumn: { name: 'user_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'equipment_id', referencedColumnName: 'id' },
    }),
    __metadata("design:type", Array)
], User.prototype, "equipment", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => password_otp_entity_1.PasswordOtp, (otp) => otp.user),
    __metadata("design:type", Array)
], User.prototype, "otps", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users')
], User);
//# sourceMappingURL=user.entity.js.map