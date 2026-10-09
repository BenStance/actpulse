"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DevicesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const device_entity_1 = require("./device.entity");
const device_binding_entity_1 = require("./device-binding.entity");
const device_key_audit_entity_1 = require("./device-key-audit.entity");
const devices_controller_1 = require("./devices.controller");
const devices_service_1 = require("./devices.service");
const equipment_entity_1 = require("../equipment/equipment.entity");
const monitoring_module_1 = require("../monitoring/monitoring.module");
const organization_entity_1 = require("../organizations/organization.entity");
const user_entity_1 = require("../users/user.entity");
let DevicesModule = class DevicesModule {
};
exports.DevicesModule = DevicesModule;
exports.DevicesModule = DevicesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                device_entity_1.Device,
                device_binding_entity_1.DeviceBinding,
                device_key_audit_entity_1.DeviceKeyAudit,
                equipment_entity_1.Equipment,
                organization_entity_1.Organization,
                user_entity_1.User,
            ]),
            monitoring_module_1.MonitoringModule,
        ],
        controllers: [devices_controller_1.DevicesController],
        providers: [devices_service_1.DevicesService],
        exports: [devices_service_1.DevicesService, typeorm_1.TypeOrmModule],
    })
], DevicesModule);
//# sourceMappingURL=devices.module.js.map