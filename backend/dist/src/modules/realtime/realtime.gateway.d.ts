import { OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
export declare class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
    private readonly jwtService;
    private readonly configService;
    server: Server;
    constructor(jwtService: JwtService, configService: ConfigService);
    afterInit(): void;
    handleConnection(client: Socket): Promise<void>;
    emitDeviceStatusUpdated(deviceId: string, status: string, timestamp: Date, userIds?: string[]): void;
    emitDeviceOnline(deviceId: string): void;
    emitDeviceOffline(deviceId: string): void;
    private extractToken;
}
