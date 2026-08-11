"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const token_blacklist_entity_1 = require("../auth/token-blacklist.entity");
const device_entity_1 = require("../devices/device.entity");
const sensor_log_entity_1 = require("../sensors/sensor-log.entity");
const user_entity_1 = require("../users/user.entity");
const reports_controller_1 = require("./reports.controller");
const reports_service_1 = require("./reports.service");
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([user_entity_1.User, device_entity_1.Device, sensor_log_entity_1.SensorLog, token_blacklist_entity_1.TokenBlacklist])],
        controllers: [reports_controller_1.ReportsController],
        providers: [reports_service_1.ReportsService, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard],
        exports: [reports_service_1.ReportsService],
    })
], ReportsModule);
//# sourceMappingURL=reports.module.js.map