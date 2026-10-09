import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuthSessionService } from '../auth/auth-session.service';
import { EntitlementService } from '../billing/entitlement.service';

@Injectable()
@WebSocketGateway({ cors: true })
export class RealtimeGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server!: Server;
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();
  private invalidation?: Subscription;

  constructor(
    private readonly sessions: AuthSessionService,
    private readonly entitlements: EntitlementService,
  ) {}

  afterInit(): void {
    this.invalidation = this.sessions.invalidated$.subscribe((id) => {
      this.server.in(`user:${id}`).disconnectSockets(true);
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const { user, expiresAt } = await this.sessions.validate(
        this.extractToken(client),
      );
      let entitlementEnd = expiresAt;
      if (user.role === UserRole.CONTROLLER) {
        const status = await this.entitlements.assert(
          user.organizationId,
          'live_monitoring',
        );
        const end =
          status.state === 'TRIALING'
            ? status.trialEndsAt
            : status.state === 'GRACE'
              ? status.graceEndsAt
              : status.paidEndAt;
        if (end)
          entitlementEnd = Math.min(entitlementEnd, new Date(end).getTime());
      }
      void client.join(`user:${user.id}`);
      if (user.role === UserRole.ADMIN) void client.join('admins');
      const remaining = entitlementEnd - Date.now();
      if (remaining <= 0) throw new Error('Expired');
      this.expiryTimers.set(
        client.id,
        setTimeout(() => client.disconnect(true), remaining),
      );
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const timer = this.expiryTimers.get(client.id);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(client.id);
  }

  onModuleDestroy(): void {
    this.invalidation?.unsubscribe();
    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
  }

  emitDeviceStatusUpdated(
    deviceId: string,
    status: string,
    timestamp: Date,
    userIds: string[],
  ) {
    const payload = { deviceId, status, timestamp };
    this.server.to('admins').emit('device.status.updated', payload);
    userIds.forEach((id) =>
      this.server.to(`user:${id}`).emit('device.status.updated', payload),
    );
  }

  emitDeviceOnline(deviceId: string, userIds: string[]) {
    const payload = { deviceId, timestamp: new Date() };
    this.server.to('admins').emit('device.online', payload);
    userIds.forEach((id) =>
      this.server.to(`user:${id}`).emit('device.online', payload),
    );
  }

  emitDeviceOffline(deviceId: string, userIds: string[]) {
    const payload = { deviceId, timestamp: new Date() };
    this.server.to('admins').emit('device.offline', payload);
    userIds.forEach((id) =>
      this.server.to(`user:${id}`).emit('device.offline', payload),
    );
  }

  emitEquipmentState(
    equipmentId: string,
    status: string,
    timestamp: Date,
    deviceId: string,
    kind: string,
    userIds: string[],
  ) {
    const payload = { equipmentId, deviceId, status, timestamp, kind };
    this.server.to('admins').emit('equipment.state.updated', payload);
    userIds.forEach((id) =>
      this.server.to(`user:${id}`).emit('equipment.state.updated', payload),
    );
    this.emitDeviceStatusUpdated(deviceId, status, timestamp, userIds);
  }

  emitMonitorConnectivity(
    deviceId: string,
    equipmentId: string | null,
    state: string,
    timestamp: Date,
    userIds: string[],
  ) {
    const payload = { deviceId, equipmentId, state, timestamp };
    this.server.to('admins').emit('monitor.connection.updated', payload);
    userIds.forEach((id) =>
      this.server.to(`user:${id}`).emit('monitor.connection.updated', payload),
    );
    if (state === 'OFFLINE') this.emitDeviceOffline(deviceId, userIds);
    else this.emitDeviceOnline(deviceId, userIds);
  }

  emitOperationalUpdate(equipmentId: string, kind: string, userIds: string[]) {
    const payload = { equipmentId, kind, timestamp: new Date() };
    this.server.to('admins').emit('operations.updated', payload);
    userIds.forEach((id) =>
      this.server.to(`user:${id}`).emit('operations.updated', payload),
    );
  }

  emitAlertUpdate(equipmentId: string, userIds: string[]) {
    const payload = { equipmentId, timestamp: new Date() };
    this.server.to('admins').emit('alerts.updated', payload);
    userIds.forEach((id) =>
      this.server.to(`user:${id}`).emit('alerts.updated', payload),
    );
  }

  private extractToken(client: Socket): string {
    const auth = (client.handshake.auth as Record<string, unknown> | undefined)
      ?.token;
    if (typeof auth === 'string' && auth.length > 0)
      return auth.replace(/^Bearer /, '').trim();
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer '))
      return header.slice(7).trim();
    return '';
  }
}
