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
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const token_blacklist_entity_1 = require("../../modules/auth/token-blacklist.entity");
const user_entity_1 = require("../../modules/users/user.entity");
let JwtAuthGuard = class JwtAuthGuard extends (0, passport_1.AuthGuard)('jwt') {
    tokenBlacklistRepository;
    userRepository;
    constructor(tokenBlacklistRepository, userRepository) {
        super();
        this.tokenBlacklistRepository = tokenBlacklistRepository;
        this.userRepository = userRepository;
    }
    async canActivate(context) {
        const active = await super.canActivate(context);
        if (!active) {
            return false;
        }
        const req = context.switchToHttp().getRequest();
        const authHeader = req.headers.authorization ?? '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        if (!token) {
            throw new common_1.UnauthorizedException('Missing bearer token');
        }
        const blacklisted = await this.tokenBlacklistRepository.findOne({ where: { token } });
        if (blacklisted) {
            throw new common_1.UnauthorizedException('Token has been invalidated');
        }
        const user = await this.userRepository.findOne({ where: { id: req.user?.sub } });
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('User not active');
        }
        if ((req.user?.tokenVersion ?? 0) !== user.tokenVersion) {
            throw new common_1.UnauthorizedException('Session expired');
        }
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(token_blacklist_entity_1.TokenBlacklist)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map