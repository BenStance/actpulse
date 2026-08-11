import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SensorStatus } from '../../common/enums/sensor-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { Device } from '../devices/device.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    @InjectRepository(SensorLog)
    private readonly sensorLogsRepository: Repository<SensorLog>,
  ) {}

  async getSummary(userId: string) {
    const deviceIds = await this.resolveDeviceIds(userId);
    if (deviceIds.length === 0) {
      return {
        totalDevices: 0,
        activeDevices: 0,
        onlineDevices: 0,
        onCount: 0,
        offCount: 0,
      };
    }

    const [totalDevices, activeDevices] = await Promise.all([
      this.devicesRepository.count({ where: { id: In(deviceIds) } }),
      this.devicesRepository.count({ where: { id: In(deviceIds), isActive: true } }),
    ]);

    const logs = await this.sensorLogsRepository.find({
      where: { deviceId: In(deviceIds) },
      order: { recordedAt: 'DESC' },
    });

    const latestByDevice = new Map<string, SensorStatus>();
    for (const log of logs) {
      if (!latestByDevice.has(log.deviceId)) {
        latestByDevice.set(log.deviceId, log.status);
      }
    }

    const latestStatuses = [...latestByDevice.values()];
    const onCount = latestStatuses.filter((status) => status === SensorStatus.ON).length;
    const offCount = latestStatuses.filter((status) => status === SensorStatus.OFF).length;

    return {
      totalDevices,
      activeDevices,
      onlineDevices: latestStatuses.length,
      onCount,
      offCount,
    };
  }

  async getUptime(userId: string) {
    const logs = await this.getRecentLogs(userId);
    return this.toDailySeries(logs, SensorStatus.ON, 'uptimeEvents');
  }

  async getDowntime(userId: string) {
    const logs = await this.getRecentLogs(userId);
    return this.toDailySeries(logs, SensorStatus.OFF, 'downtimeEvents');
  }

  async getActivity(userId: string) {
    const deviceIds = await this.resolveDeviceIds(userId);
    if (deviceIds.length === 0) return [];

    const rows = await this.sensorLogsRepository.find({
      where: { deviceId: In(deviceIds) },
      relations: ['device'],
      order: { recordedAt: 'DESC' },
      take: 50,
    });

    return rows.map((r) => ({
      id: r.id,
      deviceId: r.deviceId,
      deviceName: r.device?.name ?? 'Unknown',
      status: r.status,
      recordedAt: r.recordedAt,
    }));
  }

  private async getRecentLogs(userId: string) {
    const deviceIds = await this.resolveDeviceIds(userId);
    if (deviceIds.length === 0) return [];

    const from = new Date();
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);

    return this.sensorLogsRepository.find({
      where: { deviceId: In(deviceIds) },
      order: { recordedAt: 'ASC' },
    });
  }

  private toDailySeries(logs: SensorLog[], status: SensorStatus, label: string) {
    const map = new Map<string, number>();
    const today = new Date();
    const days: string[] = [];

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
      map.set(key, 0);
    }

    logs.forEach((log) => {
      if (log.status !== status) return;
      const key = log.recordedAt.toISOString().slice(0, 10);
      if (map.has(key)) {
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    });

    return days.map((day) => ({ day, [label]: map.get(day) ?? 0 }));
  }

  private async resolveDeviceIds(userId: string): Promise<string[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['devices'],
    });

    if (!user) return [];

    if (user.role === UserRole.ADMIN) {
      const all = await this.devicesRepository.find({ select: { id: true } });
      return all.map((d) => d.id);
    }

    return (user.devices ?? []).map((d) => d.id);
  }
}
