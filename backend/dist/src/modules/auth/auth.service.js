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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const otp_purpose_enum_1 = require("../../common/enums/otp-purpose.enum");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const mail_service_1 = require("../mail/mail.service");
const user_entity_1 = require("../users/user.entity");
const password_otp_entity_1 = require("./password-otp.entity");
const token_blacklist_entity_1 = require("./token-blacklist.entity");
let AuthService = class AuthService {
    usersRepository;
    otpRepository;
    tokenBlacklistRepository;
    jwtService;
    mailService;
    constructor(usersRepository, otpRepository, tokenBlacklistRepository, jwtService, mailService) {
        this.usersRepository = usersRepository;
        this.otpRepository = otpRepository;
        this.tokenBlacklistRepository = tokenBlacklistRepository;
        this.jwtService = jwtService;
        this.mailService = mailService;
    }
    async seedAdmin() {
        const email = 'benedict@act-ltd.com';
        const existing = await this.usersRepository.findOne({ where: { email } });
        if (existing) {
            return;
        }
        const passwordHash = await bcrypt.hash('45653211', 10);
        const admin = this.usersRepository.create({
            name: 'Benedict Nsale',
            email,
            password: passwordHash,
            role: user_role_enum_1.UserRole.ADMIN,
            isActive: true,
            isActivated: true,
            tokenVersion: 0,
        });
        await this.usersRepository.save(admin);
    }
    async login(dto) {
        const user = await this.usersRepository.findOne({ where: { email: dto.email }, relations: ['devices'] });
        if (!user || !user.password || !user.isActive || !user.isActivated) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const match = await bcrypt.compare(dto.password, user.password);
        if (!match) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { sub: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion };
        const accessToken = await this.jwtService.signAsync(payload);
        return {
            accessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                deviceIds: user.devices.map((d) => d.id),
            },
        };
    }
    async logout(token) {
        if (!token) {
            throw new common_1.BadRequestException('Missing token');
        }
        const exists = await this.tokenBlacklistRepository.findOne({ where: { token } });
        if (!exists) {
            const blacklisted = this.tokenBlacklistRepository.create({ token });
            await this.tokenBlacklistRepository.save(blacklisted);
        }
        return { message: 'Logged out successfully' };
    }
    async forgotPassword(dto) {
        const user = await this.usersRepository.findOne({ where: { email: dto.email } });
        if (!user) {
            return { message: 'If user exists, OTP has been sent' };
        }
        const otp = this.generateOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.otpRepository.save(this.otpRepository.create({
            userId: user.id,
            email: user.email,
            otpCode: otp,
            purpose: otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD,
            token: null,
            expiresAt,
            used: false,
        }));
        await this.mailService.sendOtpReset(user.email, otp);
        return { message: 'If user exists, OTP has been sent' };
    }
    async resetPassword(dto) {
        const otpEntry = await this.otpRepository.findOne({
            where: {
                email: dto.email,
                otpCode: dto.otp,
                purpose: otp_purpose_enum_1.OtpPurpose.FORGOT_PASSWORD,
                used: false,
            },
            order: { createdAt: 'DESC' },
        });
        if (!otpEntry || otpEntry.expiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException('Invalid or expired OTP');
        }
        const user = await this.usersRepository.findOne({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.BadRequestException('User not found');
        }
        user.password = await bcrypt.hash(dto.newPassword, 10);
        user.tokenVersion += 1;
        await this.usersRepository.save(user);
        otpEntry.used = true;
        await this.otpRepository.save(otpEntry);
        await this.mailService.sendPasswordChanged(user.email);
        return { message: 'Password reset successfully' };
    }
    async changePassword(userId, dto) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user || !user.password) {
            throw new common_1.BadRequestException('User not found');
        }
        const match = await bcrypt.compare(dto.oldPassword, user.password);
        if (!match) {
            throw new common_1.BadRequestException('Old password is incorrect');
        }
        user.password = await bcrypt.hash(dto.newPassword, 10);
        user.tokenVersion += 1;
        await this.usersRepository.save(user);
        await this.mailService.sendPasswordChanged(user.email);
        return { message: 'Password changed successfully. Please login again.' };
    }
    generateOtp() {
        return `${(0, crypto_1.randomInt)(100000, 999999)}`;
    }
    generateActivationToken() {
        return (0, crypto_1.randomBytes)(20).toString('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(password_otp_entity_1.PasswordOtp)),
    __param(2, (0, typeorm_1.InjectRepository)(token_blacklist_entity_1.TokenBlacklist)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService,
        mail_service_1.MailService])
], AuthService);
//# sourceMappingURL=auth.service.js.map