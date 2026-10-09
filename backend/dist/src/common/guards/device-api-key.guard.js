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
exports.DeviceApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const crypto_1 = require("crypto");
const typeorm_2 = require("typeorm");
const device_entity_1 = require("../../modules/devices/device.entity");
let DeviceApiKeyGuard = class DeviceApiKeyGuard {
    devices;
    constructor(devices) {
        this.devices = devices;
    }
    async canActivate(context) {
        const request = context
            .switchToHttp()
            .getRequest();
        const header = request.headers.authorization ?? '';
        if (!header.startsWith('ApiKey '))
            throw new common_1.UnauthorizedException('Invalid device authorization');
        const apiKey = header.slice(7).trim();
        if (apiKey.length < 16 || apiKey.length > 256)
            throw new common_1.UnauthorizedException('Invalid device authorization');
        const hash = (0, crypto_1.createHash)('sha256').update(apiKey).digest('hex');
        const match = /^ap_([0-9a-f]{16})\.[A-Za-z0-9_-]{40,50}$/.exec(apiKey);
        const device = await this.devices.findOne({
            where: match ? { credentialId: match[1] } : { credentialHash: hash },
            relations: ['organization', 'equipment'],
        });
        if (!device?.credentialHash ||
            !(0, crypto_1.timingSafeEqual)(Buffer.from(hash, 'hex'), Buffer.from(device.credentialHash, 'hex')) ||
            device.lifecycleState !== device_entity_1.DeviceLifecycle.ACTIVE ||
            !device.isActive ||
            !device.organization?.isActive ||
            !device.equipment?.isActive ||
            device.currentEquipmentId !== device.equipment.id)
            throw new common_1.UnauthorizedException('Invalid API key or inactive monitor');
        request.device = device;
        return true;
    }
};
exports.DeviceApiKeyGuard = DeviceApiKeyGuard;
exports.DeviceApiKeyGuard = DeviceApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(device_entity_1.Device)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DeviceApiKeyGuard);
//# sourceMappingURL=device-api-key.guard.js.map