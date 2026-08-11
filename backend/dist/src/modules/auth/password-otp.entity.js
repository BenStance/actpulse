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
exports.PasswordOtp = void 0;
const typeorm_1 = require("typeorm");
const otp_purpose_enum_1 = require("../../common/enums/otp-purpose.enum");
const user_entity_1 = require("../users/user.entity");
let PasswordOtp = class PasswordOtp {
    id;
    email;
    otpCode;
    token;
    purpose;
    expiresAt;
    used;
    userId;
    user;
    createdAt;
};
exports.PasswordOtp = PasswordOtp;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PasswordOtp.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], PasswordOtp.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'otp_code' }),
    __metadata("design:type", String)
], PasswordOtp.prototype, "otpCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true, unique: true }),
    __metadata("design:type", Object)
], PasswordOtp.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: otp_purpose_enum_1.OtpPurpose }),
    __metadata("design:type", String)
], PasswordOtp.prototype, "purpose", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], PasswordOtp.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], PasswordOtp.prototype, "used", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PasswordOtp.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.otps, { onDelete: 'CASCADE', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", Object)
], PasswordOtp.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PasswordOtp.prototype, "createdAt", void 0);
exports.PasswordOtp = PasswordOtp = __decorate([
    (0, typeorm_1.Entity)('password_otps')
], PasswordOtp);
//# sourceMappingURL=password-otp.entity.js.map