import { OnModuleDestroy } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthSessionService } from '../auth/auth-session.service';
import { EntitlementService } from '../billing/entitlement.service';
export declare class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
    private readonly sessions;
    private readonly entitlements;
    server: Server;
    private readonly expiryTimers;
    private invalidation?;
    constructor(sessions: AuthSessionService, entitlements: EntitlementService);
    afterInit(): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
    onModuleDestroy(): void;
    emitDeviceStatusUpdated(deviceId: string, status: string, timestamp: Date, userIds: string[]): void;
    emitDeviceOnline(deviceId: string, userIds: string[]): void;
    emitDeviceOffline(deviceId: string, userIds: string[]): void;
    emitEquipmentState(equipmentId: string, status: string, timestamp: Date, deviceId: string, kind: string, userIds: string[]): void;
    emitMonitorConnectivity(deviceId: string, equipmentId: string | null, state: string, timestamp: Date, userIds: string[]): void;
    emitOperationalUpdate(equipmentId: string, kind: string, userIds: string[]): void;
    emitAlertUpdate(equipmentId: string, userIds: string[]): void;
    private extractToken;
}
