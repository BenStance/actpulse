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
exports.RealtimeGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const socket_io_1 = require("socket.io");
let RealtimeGateway = class RealtimeGateway {
    jwtService;
    configService;
    server;
    constructor(jwtService, configService) {
        this.jwtService = jwtService;
        this.configService = configService;
    }
    afterInit() {
    }
    async handleConnection(client) {
        try {
            const token = this.extractToken(client);
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.configService.get('jwtSecret', 'actpulse_dev_secret'),
            });
            client.data.user = payload;
            client.join(`user:${payload.sub}`);
        }
        catch {
            client.disconnect(true);
        }
    }
    emitDeviceStatusUpdated(deviceId, status, timestamp, userIds) {
        const payload = { deviceId, status, timestamp };
        if (userIds && userIds.length > 0) {
            userIds.forEach((id) => this.server.to(`user:${id}`).emit('device.status.updated', payload));
            return;
        }
        this.server.emit('device.status.updated', payload);
    }
    emitDeviceOnline(deviceId) {
        this.server.emit('device.online', { deviceId, timestamp: new Date() });
    }
    emitDeviceOffline(deviceId) {
        this.server.emit('device.offline', { deviceId, timestamp: new Date() });
    }
    extractToken(client) {
        const auth = client.handshake.auth?.token;
        if (typeof auth === 'string' && auth.length > 0) {
            return auth.replace('Bearer ', '').trim();
        }
        const header = client.handshake.headers.authorization;
        if (typeof header === 'string' && header.startsWith('Bearer ')) {
            return header.slice(7).trim();
        }
        throw new Error('Missing token');
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RealtimeGateway.prototype, "server", void 0);
__decorate([
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], RealtimeGateway.prototype, "handleConnection", null);
exports.RealtimeGateway = RealtimeGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: true }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        config_1.ConfigService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map