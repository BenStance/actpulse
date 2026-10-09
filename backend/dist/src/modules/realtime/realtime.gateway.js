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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const user_role_enum_1 = require("../../common/enums/user-role.enum");
const auth_session_service_1 = require("../auth/auth-session.service");
const entitlement_service_1 = require("../billing/entitlement.service");
let RealtimeGateway = class RealtimeGateway {
    sessions;
    entitlements;
    server;
    expiryTimers = new Map();
    invalidation;
    constructor(sessions, entitlements) {
        this.sessions = sessions;
        this.entitlements = entitlements;
    }
    afterInit() {
        this.invalidation = this.sessions.invalidated$.subscribe((id) => {
            this.server.in(`user:${id}`).disconnectSockets(true);
        });
    }
    async handleConnection(client) {
        try {
            const { user, expiresAt } = await this.sessions.validate(this.extractToken(client));
            let entitlementEnd = expiresAt;
            if (user.role === user_role_enum_1.UserRole.CONTROLLER) {
                const status = await this.entitlements.assert(user.organizationId, 'live_monitoring');
                const end = status.state === 'TRIALING'
                    ? status.trialEndsAt
                    : status.state === 'GRACE'
                        ? status.graceEndsAt
                        : status.paidEndAt;
                if (end)
                    entitlementEnd = Math.min(entitlementEnd, new Date(end).getTime());
            }
            void client.join(`user:${user.id}`);
            if (user.role === user_role_enum_1.UserRole.ADMIN)
                void client.join('admins');
            const remaining = entitlementEnd - Date.now();
            if (remaining <= 0)
                throw new Error('Expired');
            this.expiryTimers.set(client.id, setTimeout(() => client.disconnect(true), remaining));
        }
        catch {
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        const timer = this.expiryTimers.get(client.id);
        if (timer)
            clearTimeout(timer);
        this.expiryTimers.delete(client.id);
    }
    onModuleDestroy() {
        this.invalidation?.unsubscribe();
        for (const timer of this.expiryTimers.values())
            clearTimeout(timer);
    }
    emitDeviceStatusUpdated(deviceId, status, timestamp, userIds) {
        const payload = { deviceId, status, timestamp };
        this.server.to('admins').emit('device.status.updated', payload);
        userIds.forEach((id) => this.server.to(`user:${id}`).emit('device.status.updated', payload));
    }
    emitDeviceOnline(deviceId, userIds) {
        const payload = { deviceId, timestamp: new Date() };
        this.server.to('admins').emit('device.online', payload);
        userIds.forEach((id) => this.server.to(`user:${id}`).emit('device.online', payload));
    }
    emitDeviceOffline(deviceId, userIds) {
        const payload = { deviceId, timestamp: new Date() };
        this.server.to('admins').emit('device.offline', payload);
        userIds.forEach((id) => this.server.to(`user:${id}`).emit('device.offline', payload));
    }
    emitEquipmentState(equipmentId, status, timestamp, deviceId, kind, userIds) {
        const payload = { equipmentId, deviceId, status, timestamp, kind };
        this.server.to('admins').emit('equipment.state.updated', payload);
        userIds.forEach((id) => this.server.to(`user:${id}`).emit('equipment.state.updated', payload));
        this.emitDeviceStatusUpdated(deviceId, status, timestamp, userIds);
    }
    emitMonitorConnectivity(deviceId, equipmentId, state, timestamp, userIds) {
        const payload = { deviceId, equipmentId, state, timestamp };
        this.server.to('admins').emit('monitor.connection.updated', payload);
        userIds.forEach((id) => this.server.to(`user:${id}`).emit('monitor.connection.updated', payload));
        if (state === 'OFFLINE')
            this.emitDeviceOffline(deviceId, userIds);
        else
            this.emitDeviceOnline(deviceId, userIds);
    }
    emitOperationalUpdate(equipmentId, kind, userIds) {
        const payload = { equipmentId, kind, timestamp: new Date() };
        this.server.to('admins').emit('operations.updated', payload);
        userIds.forEach((id) => this.server.to(`user:${id}`).emit('operations.updated', payload));
    }
    emitAlertUpdate(equipmentId, userIds) {
        const payload = { equipmentId, timestamp: new Date() };
        this.server.to('admins').emit('alerts.updated', payload);
        userIds.forEach((id) => this.server.to(`user:${id}`).emit('alerts.updated', payload));
    }
    extractToken(client) {
        const auth = client.handshake.auth
            ?.token;
        if (typeof auth === 'string' && auth.length > 0)
            return auth.replace(/^Bearer /, '').trim();
        const header = client.handshake.headers.authorization;
        if (typeof header === 'string' && header.startsWith('Bearer '))
            return header.slice(7).trim();
        return '';
    }
};
exports.RealtimeGateway = RealtimeGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], RealtimeGateway.prototype, "server", void 0);
exports.RealtimeGateway = RealtimeGateway = __decorate([
    (0, common_1.Injectable)(),
    (0, websockets_1.WebSocketGateway)({ cors: true }),
    __metadata("design:paramtypes", [auth_session_service_1.AuthSessionService,
        entitlement_service_1.EntitlementService])
], RealtimeGateway);
//# sourceMappingURL=realtime.gateway.js.map