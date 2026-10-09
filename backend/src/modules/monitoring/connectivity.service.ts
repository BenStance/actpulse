import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, ConnectivityState } from '../devices/device.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { User } from '../users/user.entity';
import { ConnectivityEvent } from './connectivity-event.entity';

@Injectable()
export class ConnectivityService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(ConnectivityEvent)
    private readonly events: Repository<ConnectivityEvent>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly realtime: RealtimeGateway,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.reconcile().catch(() => undefined);
    }, 15000);
    this.timer.unref();
    void this.reconcile().catch(() => undefined);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async reconcile(now = new Date()) {
    const stale = await this.devices
      .createQueryBuilder('d')
      .where('d.connectivity_state=:online', {
        online: ConnectivityState.ONLINE,
      })
      .andWhere(
        "d.last_seen_at + (d.offline_timeout_seconds * interval '1 second') <= :now",
        { now },
      )
      .getMany();
    for (const device of stale) {
      const result = await this.devices
        .createQueryBuilder()
        .update(Device)
        .set({ connectivityState: ConnectivityState.OFFLINE })
        .where('id=:id AND connectivity_state=:state', {
          id: device.id,
          state: ConnectivityState.ONLINE,
        })
        .execute();
      if (!result.affected) continue;
      const occurredAt = new Date(
        device.lastSeenAt!.getTime() + device.offlineTimeoutSeconds * 1000,
      );
      await this.events.save(
        this.events.create({
          deviceId: device.id,
          equipmentId: device.currentEquipmentId,
          type: 'OFFLINE',
          occurredAt,
        }),
      );
      const recipients = await this.recipientIds(
        device.currentEquipmentId,
        device.organizationId,
      );
      this.realtime.emitMonitorConnectivity(
        device.id,
        device.currentEquipmentId,
        'OFFLINE',
        occurredAt,
        recipients,
      );
    }
  }
  async recipientIds(
    equipmentId: string | null,
    organizationId: string,
  ): Promise<string[]> {
    if (!equipmentId) return [];
    const rows = await this.users
      .createQueryBuilder('u')
      .innerJoin('user_equipment', 'ue', 'ue.user_id=u.id')
      .where('ue.equipment_id=:equipmentId', { equipmentId })
      .andWhere('u.organization_id=:organizationId', { organizationId })
      .andWhere('u.is_active=true AND u.is_activated=true')
      .select('u.id', 'id')
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }
}
