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
const typeorm_2 = require("typeorm");
const otp_purpose_enum_1 = require("../../common/enums/otp-purpose.enum");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const mail_service_1 = require("../mail/mail.service");
const auth_service_1 = require("../auth/auth.service");
const password_otp_entity_1 = require("../auth/password-otp.entity");
const device_entity_1 = require("../devices/device.entity");
const user_entity_1 = require("./user.entity");
let UsersService = class UsersService {
    usersRepository;
    devicesRepository;
    otpRepository;
    authService;
    mailService;
    constructor(usersRepository, devicesRepository, otpRepository, authService, mailService) {
        this.usersRepository = usersRepository;
        this.devicesRepository = devicesRepository;
        this.otpRepository = otpRepository;
        this.authService = authService;
        this.mailService = mailService;
    }
    async create(dto) {
        if (dto.role === user_role_enum_1.UserRole.ADMIN) {
            throw new common_1.BadRequestException('Admin users are seeded by system bootstrap');
        }
        if (dto.role === user_role_enum_1.UserRole.USER) {
            throw new common_1.BadRequestException('User role is disabled. Only Controller can be invited');
        }
        const existing = await this.usersRepository.findOne({ where: { email: dto.email } });
        if (existing) {
            throw new common_1.BadRequestException('Email already exists');
        }
        const devices = await this.devicesRepository.findBy({ id: (0, typeorm_2.In)(dto.deviceIds) });
        if (devices.length < 1) {
            throw new common_1.BadRequestException('User must be assigned at least one valid device');
        }
        const user = this.usersRepository.create({
            name: dto.name,
            email: dto.email,
            role: dto.role,
            isActive: true,
            isActivated: false,
            password: null,
            devices,
            tokenVersion: 0,
        });
        const saved = await this.usersRepository.save(user);
        const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
        const token = this.authService.generateActivationToken();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await this.otpRepository.save(this.otpRepository.create({
            userId: saved.id,
            email: saved.email,
            otpCode: otp,
            token,
            purpose: otp_purpose_enum_1.OtpPurpose.USER_INVITATION,
            expiresAt,
            used: false,
        }));
        await this.mailService.sendUserInvitation(saved.email, otp, token);
        return {
            message: 'User invited successfully',
            userId: saved.id,
            activationToken: token,
        };
    }
    async activateUser(dto) {
        const user = await this.usersRepository.findOne({ where: { email: dto.email } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const otpEntry = await this.otpRepository.findOne({
            where: {
                userId: user.id,
                otpCode: dto.otp,
                purpose: otp_purpose_enum_1.OtpPurpose.USER_INVITATION,
                used: false,
            },
            order: { createdAt: 'DESC' },
        });
        if (!otpEntry || otpEntry.expiresAt.getTime() < Date.now()) {
            throw new common_1.BadRequestException('Invalid or expired activation OTP');
        }
        if (otpEntry.token && dto.token && otpEntry.token !== dto.token) {
            throw new common_1.BadRequestException('Invalid activation token');
        }
        user.password = await bcrypt.hash(dto.password, 10);
        user.isActivated = true;
        await this.usersRepository.save(user);
        otpEntry.used = true;
        await this.otpRepository.save(otpEntry);
        return { message: 'User activated successfully' };
    }
    findAll() {
        return this.usersRepository.find({ relations: ['devices'] });
    }
    async findOne(id) {
        const user = await this.usersRepository.findOne({ where: { id }, relations: ['devices'] });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async update(id, dto) {
        const user = await this.findOne(id);
        if (dto.deviceIds && dto.deviceIds.length > 0) {
            const devices = await this.devicesRepository.findBy({ id: (0, typeorm_2.In)(dto.deviceIds) });
            if (devices.length < 1) {
                throw new common_1.BadRequestException('At least one valid device is required');
            }
            user.devices = devices;
        }
        if (dto.name)
            user.name = dto.name;
        if (dto.role) {
            if (dto.role === user_role_enum_1.UserRole.USER) {
                throw new common_1.BadRequestException('User role is disabled. Use Controller role');
            }
            user.role = dto.role;
        }
        await this.usersRepository.save(user);
        return this.findOne(id);
    }
    async deactivate(id) {
        const user = await this.findOne(id);
        user.isActive = false;
        user.tokenVersion += 1;
        await this.usersRepository.save(user);
        return { message: 'User deactivated successfully' };
    }
    async assignDevices(id, dto) {
        const user = await this.findOne(id);
        const devices = await this.devicesRepository.findBy({ id: (0, typeorm_2.In)(dto.deviceIds) });
        if (devices.length < 1) {
            throw new common_1.BadRequestException('At least one valid device is required');
        }
        user.devices = devices;
        await this.usersRepository.save(user);
        return this.findOne(id);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(device_entity_1.Device)),
    __param(2, (0, typeorm_1.InjectRepository)(password_otp_entity_1.PasswordOtp)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        auth_service_1.AuthService,
        mail_service_1.MailService])
], UsersService);
//# sourceMappingURL=users.service.js.map