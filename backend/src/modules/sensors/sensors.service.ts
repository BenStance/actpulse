import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../devices/device.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SensorLog } from './sensor-log.entity';
import { SensorStatusDto } from './dto/sensor-status.dto';

@Injectable()
export class SensorsService {
  private readonly heartbeatTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(SensorLog)
    private readonly sensorLogRepository: Repository<SensorLog>,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async pushStatus(device: Device, dto: SensorStatusDto) {
    const lastLog = await this.sensorLogRepository.findOne({
      where: { deviceId: device.id },
      order: { recordedAt: 'DESC' },
    });

    if (lastLog?.status === dto.status) {
      return { message: 'Duplicate state ignored' };
    }

    const recordedAt = dto.timestamp ? new Date(dto.timestamp * 1000) : new Date();
    const entry = this.sensorLogRepository.create({
      deviceId: device.id,
      status: dto.status,
      recordedAt,
    });
    const saved = await this.sensorLogRepository.save(entry);

    const userIds = (device.users ?? []).map((u) => u.id);
    this.realtimeGateway.emitDeviceStatusUpdated(device.id, dto.status, saved.recordedAt, userIds);

    return { message: 'Status accepted', logId: saved.id };
  }

  heartbeat(device: Device) {
    this.realtimeGateway.emitDeviceOnline(device.id);

    const existing = this.heartbeatTimers.get(device.id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.realtimeGateway.emitDeviceOffline(device.id);
      this.heartbeatTimers.delete(device.id);
    }, 120000);

    this.heartbeatTimers.set(device.id, timer);
    return { message: 'Heartbeat accepted' };
  }
}
