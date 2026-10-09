import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Device,
  ConnectivityState,
  DeviceLifecycle,
} from '../devices/device.entity';
import { ConnectivityEvent } from '../monitoring/connectivity-event.entity';
import { ConnectivityService } from '../monitoring/connectivity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SensorLog } from './sensor-log.entity';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { SensorStatusDto } from './dto/sensor-status.dto';

@Injectable()
export class SensorsService {
  constructor(
    @InjectRepository(SensorLog) private readonly logs: Repository<SensorLog>,
    private readonly dataSource: DataSource,
    private readonly connectivity: ConnectivityService,
    private readonly realtime: RealtimeGateway,
  ) {}
  async pushStatus(
    device: Device,
    dto: SensorStatusDto,
    source: 'DEVICE' | 'SIMULATOR' = 'DEVICE',
  ) {
    if (!device.currentEquipmentId)
      throw new BadRequestException('Monitor is not bound to equipment');
    const now = new Date();
    const observedAt = this.observedAt(dto, now);
    let result!: { message: string; logId: string | null; kind: string };
    let connectionEvent: 'FIRST_CONTACT' | 'ONLINE' | null = null;
    await this.dataSource.transaction(async (manager) => {
      const current = await manager.getRepository(Device).findOne({
        where: { id: device.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !current?.currentEquipmentId ||
        !current.isActive ||
        current.lifecycleState !== DeviceLifecycle.ACTIVE
      )
        throw new BadRequestException('Monitor is inactive or unbound');
      const latest = await manager.getRepository(SensorLog).findOne({
        where: { deviceId: device.id },
        order: { recordedAt: 'DESC', id: 'DESC' },
      });
      if (dto.eventId) {
        const duplicate = await manager
          .getRepository(SensorLog)
          .findOne({ where: { deviceId: device.id, eventId: dto.eventId } });
        if (duplicate) {
          connectionEvent = await this.touch(manager, current, now);
          result = {
            message: 'Duplicate event ignored',
            logId: duplicate.id,
            kind: duplicate.kind,
          };
          return;
        }
      }
      if (latest && observedAt.getTime() < latest.recordedAt.getTime())
        throw new ConflictException('Out-of-order observation rejected');
      connectionEvent = await this.touch(manager, current, now);
      const kind =
        latest && latest.status === dto.status ? 'CONFIRMATION' : 'TRANSITION';
      const log = await manager.save(
        SensorLog,
        manager.create(SensorLog, {
          deviceId: device.id,
          equipmentId: current.currentEquipmentId,
          status: dto.status,
          recordedAt: observedAt,
          receivedAt: now,
          timestampBasis:
            dto.observedAt || dto.timestamp ? 'DEVICE' : 'RECEIVED',
          source,
          eventId: dto.eventId || null,
          kind,
        }),
      );
      await manager.update(Device, device.id, { lastStatusAt: now });
      result = { message: 'Status accepted', logId: log.id, kind };
    });
    const recipients = await this.connectivity.recipientIds(
      device.currentEquipmentId,
      device.organizationId,
    );
    if (connectionEvent)
      this.realtime.emitMonitorConnectivity(
        device.id,
        device.currentEquipmentId,
        connectionEvent,
        now,
        recipients,
      );
    if (result.message === 'Status accepted')
      this.realtime.emitEquipmentState(
        device.currentEquipmentId,
        dto.status,
        observedAt,
        device.id,
        result.kind,
        recipients,
      );
    return result;
  }
  async heartbeat(device: Device, dto: HeartbeatDto) {
    if (dto.status)
      return this.pushStatus(device, {
        status: dto.status,
        timestamp: dto.timestamp,
      });
    const now = new Date();
    let event: 'FIRST_CONTACT' | 'ONLINE' | null = null;
    await this.dataSource.transaction(async (manager) => {
      const current = await manager.getRepository(Device).findOne({
        where: { id: device.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !current?.currentEquipmentId ||
        !current.isActive ||
        current.lifecycleState !== DeviceLifecycle.ACTIVE
      )
        throw new BadRequestException('Monitor is inactive or unbound');
      event = await this.touch(manager, current, now);
    });
    if (event) {
      const recipients = await this.connectivity.recipientIds(
        device.currentEquipmentId,
        device.organizationId,
      );
      this.realtime.emitMonitorConnectivity(
        device.id,
        device.currentEquipmentId,
        event,
        now,
        recipients,
      );
    }
    return {
      message: 'Heartbeat accepted',
      connectivity: 'ONLINE',
      equipmentStateConfirmed: false,
    };
  }
  private observedAt(dto: SensorStatusDto, receivedAt: Date): Date {
    if (dto.observedAt && dto.timestamp)
      throw new BadRequestException(
        'Use observedAt or legacy timestamp, not both',
      );
    const observed = dto.observedAt
      ? new Date(dto.observedAt)
      : dto.timestamp
        ? new Date(dto.timestamp * 1000)
        : receivedAt;
    if (
      !Number.isFinite(observed.getTime()) ||
      observed.getTime() > receivedAt.getTime() + 300000 ||
      observed.getTime() < receivedAt.getTime() - 300000
    )
      throw new BadRequestException(
        'Observation timestamp must be within five minutes of server receipt',
      );
    return observed;
  }
  private async touch(
    manager: DataSource['manager'],
    device: Device,
    now: Date,
  ): Promise<'FIRST_CONTACT' | 'ONLINE' | null> {
    const wasNever = !device.firstSeenAt;
    const wasOffline =
      device.connectivityState !== ConnectivityState.ONLINE ||
      !device.lastSeenAt ||
      now.getTime() - device.lastSeenAt.getTime() >
        device.offlineTimeoutSeconds * 1000;
    const event = wasNever ? 'FIRST_CONTACT' : wasOffline ? 'ONLINE' : null;
    await manager.update(Device, device.id, {
      firstSeenAt: device.firstSeenAt ?? now,
      lastSeenAt: now,
      connectivityState: ConnectivityState.ONLINE,
      connectedSinceAt: wasOffline ? now : device.connectedSinceAt,
    });
    if (event)
      await manager.save(
        ConnectivityEvent,
        manager.create(ConnectivityEvent, {
          deviceId: device.id,
          equipmentId: device.currentEquipmentId,
          type: event,
          occurredAt: now,
        }),
      );
    return event;
  }
}
