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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const typeorm_2 = require("typeorm");
const otp_purpose_enum_1 = require("../../common/enums/otp-purpose.enum");
const password_1 = require("../../common/security/password");
const mail_service_1 = require("../mail/mail.service");
const user_entity_1 = require("../users/user.entity");
const user_response_1 = require("../users/user-response");
const auth_rate_limiter_service_1 = require("./auth-rate-limiter.service");
const auth_session_service_1 = require("./auth-session.service");
const credential_hash_1 = require("./credential-hash");
const password_otp_entity_1 = require("./password-otp.entity");
const token_blacklist_entity_1 = require("./token-blacklist.entity");
const token_digest_1 = require("./token-digest");
let AuthService = AuthService_1 = class AuthService {
    users;
    otps;
    blacklist;
    dataSource;
    jwt;
    mail;
    sessions;
    rate;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(users, otps, blacklist, dataSource, jwt, mail, sessions, rate) {
        this.users = users;
        this.otps = otps;
        this.blacklist = blacklist;
        this.dataSource = dataSource;
        this.jwt = jwt;
        this.mail = mail;
        this.sessions = sessions;
        this.rate = rate;
    }
    async login(dto, ip) {
        const email = dto.email.trim().toLowerCase();
        this.rate.check('login', `${ip}:${email}`);
        const user = await this.users.findOne({
            where: { email },
            relations: ['equipment', 'equipment.monitors', 'organization'],
        });
        if (!user ||
            !user.password ||
            !user.isActive ||
            !user.isActivated ||
            (user.organization && !user.organization.isActive) ||
            !(await bcrypt.compare(dto.password, user.password))) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const accessToken = await this.jwt.signAsync({
            sub: user.id,
            tokenVersion: user.tokenVersion,
        });
        return { accessToken, user: (0, user_response_1.accountSummary)(user) };
    }
    async logout(token, userId) {
        if (!token)
            throw new common_1.BadRequestException('Missing token');
        const digest = (0, token_digest_1.tokenDigest)(token);
        if (!(await this.blacklist.exists({ where: { token: digest } }))) {
            await this.blacklist.save(this.blacklist.create({ token: digest }));
        }
        this.sessions.invalidateUser(userId);
        return { message: 'Logged out successfully' };
    }
    async me(userId) {
        const user = await this.users.findOneOrFail({
            where: { id: userId },
            relations: ['organization', 'equipment', 'equipment.monitors'],
        });
        return (0, user_response_1.accountSummary)(user);
    }
    async updateProfile(userId, dto) {
        const name = dto.name.trim();
        if (name.length < 2)
            throw new common_1.BadRequestException('Name must have at least two characters');
        await this.users.update(userId, { name });
        return this.me(userId);
    }
    async forgotPassword(dto, ip) {
        const email = dto.email.trim().toLowerCase();
        this.rate.check('request', `${ip}:${email}`);
        const message = {
            message: 'If the account is eligible, a reset code will be sent',
        };
        const user = await this.users.findOne({ where: { email } });
        if (!user || !user.isActive || !user.isActivated)
            return message;
        const otp = (0, credential_hash_1.newOtp)();
        try {
            await this.dataSource.transaction(async (manager) => {
                await manager.update(password_otp_entity_1.PasswordOtp, { userId: user.id, purpose: otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD, used: false }, { used: true });
                await manager.save(password_otp_entity_1.PasswordOtp, manager.create(password_otp_entity_1.PasswordOtp, {
                    userId: user.id,
                    email,
                    otpCode: (0, credential_hash_1.otpHash)(otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD, email, otp),
                    purpose: otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD,
                    token: null,
                    expiresAt: new Date(Date.now() + 10 * 60_000),
                    used: false,
                    failedAttempts: 0,
                }));
                await this.mail.sendOtpReset(email, otp);
            });
        }
        catch {
            this.logger.error('Password reset delivery failed');
        }
        return message;
    }
    async resetPassword(dto, ip) {
        const email = dto.email.trim().toLowerCase();
        this.rate.check('verify', `${ip}:${email}`);
        (0, password_1.validateNewPassword)(dto.newPassword);
        const user = await this.users.findOne({ where: { email } });
        if (!user || !user.isActive || !user.isActivated)
            throw new common_1.BadRequestException('Invalid or expired code');
        const success = await this.dataSource.transaction(async (manager) => {
            const entry = await manager.getRepository(password_otp_entity_1.PasswordOtp).findOne({
                where: {
                    userId: user.id,
                    purpose: otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD,
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
            if (entry.otpCode !== (0, credential_hash_1.otpHash)(otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD, email, dto.otp)) {
                entry.failedAttempts += 1;
                if (entry.failedAttempts >= maxAttempts)
                    entry.used = true;
                await manager.save(entry);
                return false;
            }
            await manager.update(user_entity_1.User, user.id, {
                password: await bcrypt.hash(dto.newPassword, 12),
                tokenVersion: user.tokenVersion + 1,
            });
            await manager.update(password_otp_entity_1.PasswordOtp, { userId: user.id, purpose: otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD, used: false }, { used: true });
            return true;
        });
        if (!success)
            throw new common_1.BadRequestException('Invalid or expired code');
        this.sessions.invalidateUser(user.id);
        await this.mail
            .sendPasswordChanged(email)
            .catch(() => this.logger.warn('Password-change notice could not be delivered'));
        return { message: 'Password reset successfully' };
    }
    async changePassword(userId, dto) {
        (0, password_1.validateNewPassword)(dto.newPassword);
        const user = await this.users.findOne({ where: { id: userId } });
        if (!user?.password ||
            !(await bcrypt.compare(dto.oldPassword, user.password))) {
            throw new common_1.BadRequestException('Current password is incorrect');
        }
        user.password = await bcrypt.hash(dto.newPassword, 12);
        user.tokenVersion += 1;
        await this.users.save(user);
        this.sessions.invalidateUser(userId);
        await this.mail
            .sendPasswordChanged(user.email)
            .catch(() => this.logger.warn('Password-change notice could not be delivered'));
        return { message: 'Password changed successfully. Please login again.' };
    }
    generateActivationToken() {
        return (0, credential_hash_1.newInvitationToken)();
    }
    hashInvitation(token) {
        return (0, credential_hash_1.invitationHash)(token);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(password_otp_entity_1.PasswordOtp)),
    __param(2, (0, typeorm_1.InjectRepository)(token_blacklist_entity_1.TokenBlacklist)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        jwt_1.JwtService,
        mail_service_1.MailService,
        auth_session_service_1.AuthSessionService,
        auth_rate_limiter_service_1.AuthRateLimiterService])
], AuthService);
//# sourceMappingURL=auth.service.js.map