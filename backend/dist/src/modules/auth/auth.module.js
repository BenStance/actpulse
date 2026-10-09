"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const user_entity_1 = require("../users/user.entity");
const mail_module_1 = require("../mail/mail.module");
const auth_controller_1 = require("./auth.controller");
const auth_service_1 = require("./auth.service");
const password_otp_entity_1 = require("./password-otp.entity");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const token_blacklist_entity_1 = require("./token-blacklist.entity");
const auth_session_service_1 = require("./auth-session.service");
const auth_rate_limiter_service_1 = require("./auth-rate-limiter.service");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, password_otp_entity_1.PasswordOtp, token_blacklist_entity_1.TokenBlacklist]),
            mail_module_1.MailModule,
            jwt_1.JwtModule.registerAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => ({
                    secret: configService.getOrThrow('jwtSecret'),
                    signOptions: { expiresIn: '1d' },
                }),
            }),
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            auth_session_service_1.AuthSessionService,
            auth_rate_limiter_service_1.AuthRateLimiterService,
            jwt_auth_guard_1.JwtAuthGuard,
        ],
        exports: [
            auth_service_1.AuthService,
            auth_session_service_1.AuthSessionService,
            auth_rate_limiter_service_1.AuthRateLimiterService,
            jwt_1.JwtModule,
            typeorm_1.TypeOrmModule,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map