"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const password_otp_entity_1 = require("../auth/password-otp.entity");
const token_blacklist_entity_1 = require("../auth/token-blacklist.entity");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const auth_module_1 = require("../auth/auth.module");
const device_entity_1 = require("../devices/device.entity");
const mail_module_1 = require("../mail/mail.module");
const user_entity_1 = require("./user.entity");
const users_controller_1 = require("./users.controller");
const users_service_1 = require("./users.service");
let UsersModule = class UsersModule {
};
exports.UsersModule = UsersModule;
exports.UsersModule = UsersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, device_entity_1.Device, password_otp_entity_1.PasswordOtp, token_blacklist_entity_1.TokenBlacklist]),
            (0, common_1.forwardRef)(() => auth_module_1.AuthModule),
            mail_module_1.MailModule,
        ],
        controllers: [users_controller_1.UsersController],
        providers: [users_service_1.UsersService, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard],
        exports: [users_service_1.UsersService, typeorm_1.TypeOrmModule],
    })
], UsersModule);
//# sourceMappingURL=users.module.js.map