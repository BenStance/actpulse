import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    // gateway initialized
  }

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwtSecret', 'actpulse_dev_secret'),
      });
      client.data.user = payload;
      client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitDeviceStatusUpdated(deviceId: string, status: string, timestamp: Date, userIds?: string[]) {
    const payload = { deviceId, status, timestamp };
    if (userIds && userIds.length > 0) {
      userIds.forEach((id) => this.server.to(`user:${id}`).emit('device.status.updated', payload));
      return;
    }
    this.server.emit('device.status.updated', payload);
  }

  emitDeviceOnline(deviceId: string) {
    this.server.emit('device.online', { deviceId, timestamp: new Date() });
  }

  emitDeviceOffline(deviceId: string) {
    this.server.emit('device.offline', { deviceId, timestamp: new Date() });
  }

  private extractToken(client: Socket): string {
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
}
