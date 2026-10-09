"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const class_validator_1 = require("class-validator");
const typeorm_2 = require("typeorm");
const otp_purpose_enum_1 = require("../../common/enums/otp-purpose.enum");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const password_1 = require("../../common/security/password");
const auth_rate_limiter_service_1 = require("../auth/auth-rate-limiter.service");
const auth_session_service_1 = require("../auth/auth-session.service");
const entitlement_service_1 = require("../billing/entitlement.service");
const audit_trail_service_1 = require("../billing/audit-trail.service");
const credential_hash_1 = require("../auth/credential-hash");
const password_otp_entity_1 = require("../auth/password-otp.entity");
const device_entity_1 = require("../devices/device.entity");
const equipment_entity_1 = require("../equipment/equipment.entity");
const mail_service_1 = require("../mail/mail.service");
const organization_entity_1 = require("../organizations/organization.entity");
const user_entity_1 = require("./user.entity");
const user_response_1 = require("./user-response");
let UsersService = class UsersService {
    users;
    devices;
    equipment;
    organizations;
    dataSource;
    mail;
    sessions;
    rate;
    entitlements;
    auditTrail;
    constructor(users, devices, equipment, organizations, dataSource, mail, sessions, rate, entitlements, auditTrail) {
        this.users = users;
        this.devices = devices;
        this.equipment = equipment;
        this.organizations = organizations;
        this.dataSource = dataSource;
        this.mail = mail;
        this.sessions = sessions;
        this.rate = rate;
        this.entitlements = entitlements;
        this.auditTrail = auditTrail;
    }
    async create(dto, actorId) {
        const email = dto.email.trim().toLowerCase();
        const organization = await this.organizations.findOne({
            where: { id: dto.organizationId, isActive: true },
        });
        if (!organization)
            throw new common_1.BadRequestException('Active organization required');
        if (await this.users.exists({ where: { email } }))
            throw new common_1.BadRequestException('Email already exists');
        const assignedEquipment = await this.validEquipment(dto.equipmentIds, dto.deviceIds, organization.id);
        const otp = (0, credential_hash_1.newOtp)();
        const token = (0, credential_hash_1.newInvitationToken)();
        const userId = await this.dataSource.transaction(async (manager) => {
            await this.entitlements.lockAndCheck(organization.id, 'controllers', manager);
            const user = await manager.save(user_entity_1.User, manager.create(user_entity_1.User, {
                name: dto.name.trim(),
                email,
                role: user_role_enum_1.UserRole.CONTROLLER,
                organizationId: organization.id,
                equipment: assignedEquipment,
                isActive: true,
                isActivated: false,
                password: null,
                tokenVersion: 0,
            }));
            await manager.save(password_otp_entity_1.PasswordOtp, manager.create(password_otp_entity_1.PasswordOtp, {
                userId: user.id,
                email,
                otpCode: (0, credential_hash_1.otpHash)(otp_purpose_enum_1.OtpPurpose.USER_INVITATION, email, otp),
                token: (0, credential_hash_1.invitationHash)(token),
                purpose: otp_purpose_enum_1.OtpPurpose.USER_INVITATION,
                expiresAt: new Date(Date.now() + 30 * 60_000),
                used: false,
                failedAttempts: 0,
            }));
            await this.auditTrail.record({
                actorId,
                actorRole: 'Admin',
                organizationId: organization.id,
                action: 'USER_INVITED',
                entityType: 'user',
                entityId: user.id,
                after: {
                    role: 'Controller',
                    isActive: true,
                    assignmentCount: assignedEquipment.length,
                },
            }, manager);
            try {
                await this.mail.sendUserInvitation(email, otp, token);
            }
            catch {
                throw new common_1.ServiceUnavailableException('Invitation could not be delivered');
            }
            return user.id;
        });
        return { message: 'Controller invited', user: await this.findOne(userId) };
    }
    async resendInvitation(id) {
        const user = await this.userEntity(id);
        if (user.role !== user_role_enum_1.UserRole.CONTROLLER ||
            user.isActivated ||
            !user.isActive ||
            !user.organization?.isActive) {
            throw new common_1.BadRequestException('Only active pending Controllers can receive another invitation');
        }
        this.rate.check('request', `invitation:${id}`);
        const otp = (0, credential_hash_1.newOtp)();
        const token = (0, credential_hash_1.newInvitationToken)();
        await this.dataSource.transaction(async (manager) => {
            await manager.update(password_otp_entity_1.PasswordOtp, { userId: id, purpose: otp_purpose_enum_1.OtpPurpose.USER_INVITATION, used: false }, { used: true });
            await manager.save(password_otp_entity_1.PasswordOtp, manager.create(password_otp_entity_1.PasswordOtp, {
                userId: id,
                email: user.email,
                otpCode: (0, credential_hash_1.otpHash)(otp_purpose_enum_1.OtpPurpose.USER_INVITATION, user.email, otp),
                token: (0, credential_hash_1.invitationHash)(token),
                purpose: otp_purpose_enum_1.OtpPurpose.USER_INVITATION,
                expiresAt: new Date(Date.now() + 30 * 60_000),
                used: false,
                failedAttempts: 0,
            }));
            try {
                await this.mail.sendUserInvitation(user.email, otp, token);
            }
            catch {
                throw new common_1.ServiceUnavailableException('Invitation could not be delivered');
            }
        });
        return { message: 'Invitation resent' };
    }
    async activateUser(dto) {
        const email = dto.email.trim().toLowerCase();
        this.rate.check('verify', `invitation:${email}`);
        (0, password_1.validateNewPassword)(dto.password);
        const user = await this.users.findOne({
            where: { email },
            relations: ['organization'],
        });
        if (!user ||
            user.role !== user_role_enum_1.UserRole.CONTROLLER ||
            !user.isActive ||
            user.isActivated ||
            !user.organization?.isActive) {
            throw new common_1.BadRequestException('Invalid or expired invitation');
        }
        const activated = await this.dataSource.transaction(async (manager) => {
            const entry = await manager.getRepository(password_otp_entity_1.PasswordOtp).findOne({
                where: {
                    userId: user.id,
                    purpose: otp_purpose_enum_1.OtpPurpose.USER_INVITATION,
                    used: false,
                },
                order: { createdAt: 'DESC' },
                lock: { mode: 'pessimistic_write' },
            });
            if (!entry || entry.expiresAt.getTime() < Date.now())
                return false;
            const maxAttempts = Number(process.env.AUTH_OTP_MAX_ATTEMPTS ?? 5);
            if (entry.failedAttempts >= maxAttempts)
                return false;
            if (entry.otpCode !== (0, credential_hash_1.otpHash)(otp_purpose_enum_1.OtpPurpose.USER_INVITATION, email, dto.otp) ||
                entry.token !== (0, credential_hash_1.invitationHash)(dto.token)) {
                entry.failedAttempts += 1;
                if (entry.failedAttempts >= maxAttempts)
                    entry.used = true;
                await manager.save(entry);
                return false;
            }
            await manager.update(user_entity_1.User, user.id, {
                password: await bcrypt.hash(dto.password, 12),
                isActivated: true,
                tokenVersion: user.tokenVersion + 1,
            });
            await manager.update(password_otp_entity_1.PasswordOtp, { userId: user.id, purpose: otp_purpose_enum_1.OtpPurpose.USER_INVITATION, used: false }, { used: true });
            await this.auditTrail.record({
                actorId: user.id,
                actorRole: 'Controller',
                organizationId: user.organizationId,
                action: 'USER_ACTIVATED',
                entityType: 'user',
                entityId: user.id,
                after: { isActive: true },
            }, manager);
            return true;
        });
        if (!activated)
            throw new common_1.BadRequestException('Invalid or expired invitation');
        this.sessions.invalidateUser(user.id);
        return { message: 'User activated successfully' };
    }
    async findAll(search = '', organizationId, rawPage = 1, rawPageSize = 20) {
        if (organizationId && !(0, class_validator_1.isUUID)(organizationId))
            throw new common_1.BadRequestException('Invalid organization ID');
        const page = Math.max(1, Number.isFinite(rawPage) ? Math.floor(rawPage) : 1);
        const pageSize = Math.min(100, Math.max(1, Number.isFinite(rawPageSize) ? Math.floor(rawPageSize) : 20));
        const qb = this.users
            .createQueryBuilder('u')
            .leftJoinAndSelect('u.equipment', 'e')
            .leftJoinAndSelect('e.monitors', 'd')
            .leftJoinAndSelect('u.organization', 'o')
            .where('u.role = :role', { role: user_role_enum_1.UserRole.CONTROLLER });
        if (organizationId)
            qb.andWhere('u.organization_id = :organizationId', { organizationId });
        if (search.trim())
            qb.andWhere('(LOWER(u.name) LIKE :search OR LOWER(u.email) LIKE :search)', { search: `%${search.trim().toLowerCase()}%` });
        const [items, total] = await qb
            .orderBy('u.createdAt', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();
        return { items: items.map(user_response_1.managedUserSummary), total, page, pageSize };
    }
    async findOne(id) {
        return (0, user_response_1.managedUserSummary)(await this.userEntity(id));
    }
    async update(id, dto) {
        const user = await this.userEntity(id);
        if (user.role !== user_role_enum_1.UserRole.CONTROLLER)
            throw new common_1.BadRequestException('Only Controllers can be managed here');
        user.name = dto.name.trim();
        await this.users.save(user);
        return this.findOne(id);
    }
    async deactivate(id, actorId) {
        const user = await this.userEntity(id);
        if (user.role !== user_role_enum_1.UserRole.CONTROLLER)
            throw new common_1.BadRequestException('Only Controllers can be managed here');
        user.isActive = false;
        user.tokenVersion += 1;
        await this.dataSource.transaction(async (manager) => {
            await manager.save(user);
            await this.auditTrail.record({
                actorId,
                actorRole: 'Admin',
                organizationId: user.organizationId,
                action: 'USER_DEACTIVATED',
                entityType: 'user',
                entityId: id,
                after: { isActive: false },
            }, manager);
        });
        this.sessions.invalidateUser(id);
        return this.findOne(id);
    }
    async reactivate(id, actorId) {
        const user = await this.userEntity(id);
        if (user.role !== user_role_enum_1.UserRole.CONTROLLER || !user.organization?.isActive)
            throw new common_1.BadRequestException('Active organization required');
        await this.dataSource.transaction(async (manager) => {
            if (!user.isActive)
                await this.entitlements.lockAndCheck(user.organizationId, 'controllers', manager);
            user.isActive = true;
            await manager.save(user);
            await this.auditTrail.record({
                actorId,
                actorRole: 'Admin',
                organizationId: user.organizationId,
                action: 'USER_REACTIVATED',
                entityType: 'user',
                entityId: id,
                after: { isActive: true },
            }, manager);
        });
        return this.findOne(id);
    }
    async assignDevices(id, dto, actorId) {
        const user = await this.userEntity(id);
        if (user.role !== user_role_enum_1.UserRole.CONTROLLER || !user.organizationId)
            throw new common_1.BadRequestException('Controller required');
        user.equipment = await this.validEquipment(dto.equipmentIds, dto.deviceIds, user.organizationId);
        user.tokenVersion += 1;
        await this.dataSource.transaction(async (manager) => {
            await manager.save(user);
            await this.auditTrail.record({
                actorId,
                actorRole: 'Admin',
                organizationId: user.organizationId,
                action: 'PERMISSION_ASSIGNMENT_CHANGED',
                entityType: 'user',
                entityId: id,
                after: { assignmentCount: user.equipment.length },
            }, manager);
        });
        this.sessions.invalidateUser(id);
        return this.findOne(id);
    }
    async validEquipment(equipmentIds, deviceIds, organizationId) {
        if (equipmentIds && deviceIds)
            throw new common_1.BadRequestException('Use equipmentIds only');
        let ids = equipmentIds ?? [];
        if (deviceIds) {
            const devices = await this.devices.find({
                where: { id: (0, typeorm_2.In)(deviceIds), organizationId },
            });
            if (devices.length !== new Set(deviceIds).size ||
                devices.some((d) => !d.currentEquipmentId))
                throw new common_1.BadRequestException('One or more monitors are invalid for this organization');
            ids = devices.map((d) => d.currentEquipmentId);
        }
        if (!ids.length)
            return [];
        const unique = [...new Set(ids)];
        const rows = await this.equipment.find({
            where: { id: (0, typeorm_2.In)(unique), organizationId },
        });
        if (rows.length !== unique.length)
            throw new common_1.BadRequestException('One or more equipment records are invalid for this organization');
        return rows;
    }
    async userEntity(id) {
        const user = await this.users.findOne({
            where: { id },
            relations: ['equipment', 'equipment.monitors', 'organization'],
        });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(device_entity_1.Device)),
    __param(2, (0, typeorm_1.InjectRepository)(equipment_entity_1.Equipment)),
    __param(3, (0, typeorm_1.InjectRepository)(organization_entity_1.Organization)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        mail_service_1.MailService,
        auth_session_service_1.AuthSessionService,
        auth_rate_limiter_service_1.AuthRateLimiterService,
        entitlement_service_1.EntitlementService,
        audit_trail_service_1.AuditTrailService])
], UsersService);
//# sourceMappingURL=users.service.js.map