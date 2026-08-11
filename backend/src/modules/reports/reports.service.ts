import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, LessThan, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Device } from '../devices/device.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';

type SegmentType = 'UPTIME' | 'DOWNTIME';

export interface ReportSegment {
  start: string;
  end: string;
  durationMinutes: number;
  type: SegmentType;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    @InjectRepository(SensorLog)
    private readonly sensorLogsRepository: Repository<SensorLog>,
  ) {}

  async getDeviceUptime(userId: string, deviceId: string, from: string, to: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const device = await this.ensureDeviceAccess(userId, deviceId);
    const segments = await this.buildSegments(device.id, fromDate, toDate);
    const summary = this.summarizeSegments(segments, fromDate, toDate);

    return {
      device: { id: device.id, name: device.name },
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      summary,
      table: segments,
    };
  }

  async getDeviceDaily(userId: string, deviceId: string, from: string, to: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    await this.ensureDeviceAccess(userId, deviceId);
    const segments = await this.buildSegments(deviceId, fromDate, toDate);
    return this.toDailyBreakdown(segments, fromDate, toDate);
  }

  async getDeviceEvents(userId: string, deviceId: string, from: string, to: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    await this.ensureDeviceAccess(userId, deviceId);
    const logs = await this.sensorLogsRepository.find({
      where: { deviceId, recordedAt: Between(fromDate, toDate) },
      order: { recordedAt: 'ASC' },
    });

    const events: Array<{ timestamp: string; status: string; transition: string | null }> = [];
    let prev: string | null = null;
    for (const log of logs) {
      if (prev === null) {
        prev = log.status;
        events.push({
          timestamp: log.recordedAt.toISOString(),
          status: log.status,
          transition: null,
        });
        continue;
      }

      const transition = prev === log.status ? null : `${prev}->${log.status}`;
      events.push({
        timestamp: log.recordedAt.toISOString(),
        status: log.status,
        transition,
      });
      prev = log.status;
    }

    return {
      deviceId,
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      count: events.length,
      events,
    };
  }

  async getFleetSummary(userId: string, from: string, to: string) {
    const { fromDate, toDate } = this.parseRange(from, to);
    const deviceIds = await this.resolveAccessibleDeviceIds(userId);
    if (deviceIds.length === 0) {
      return {
        period: { from: fromDate.toISOString(), to: toDate.toISOString() },
        totals: { devices: 0, uptimeSeconds: 0, downtimeSeconds: 0, uptimePercentage: 0 },
        devices: [],
      };
    }

    const devices = await this.devicesRepository.findBy({ id: In(deviceIds) });
    const rows: Array<{ device: { id: string; name: string }; uptimeSeconds: number; downtimeSeconds: number; uptimePercentage: number }> = [];
    let totalUp = 0;
    let totalDown = 0;
    for (const device of devices) {
      const segments = await this.buildSegments(device.id, fromDate, toDate);
      const summary = this.summarizeSegments(segments, fromDate, toDate);
      totalUp += summary.uptimeSeconds;
      totalDown += summary.downtimeSeconds;
      rows.push({
        device: { id: device.id, name: device.name },
        ...summary,
      });
    }

    const denom = totalUp + totalDown;
    return {
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      totals: {
        devices: rows.length,
        uptimeSeconds: totalUp,
        downtimeSeconds: totalDown,
        uptimePercentage: denom > 0 ? Number(((totalUp / denom) * 100).toFixed(2)) : 0,
      },
      devices: rows,
    };
  }

  private parseRange(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid from/to date range');
    }
    if (toDate <= fromDate) {
      throw new BadRequestException('"to" must be greater than "from"');
    }
    return { fromDate, toDate };
  }

  private async ensureDeviceAccess(userId: string, deviceId: string) {
    const device = await this.devicesRepository.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');

    const allowed = await this.resolveAccessibleDeviceIds(userId);
    if (!allowed.includes(deviceId)) {
      throw new ForbiddenException('You do not have access to this device');
    }
    return device;
  }

  private async resolveAccessibleDeviceIds(userId: string): Promise<string[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId }, relations: ['devices'] });
    if (!user) return [];
    if (user.role === UserRole.ADMIN) {
      const all = await this.devicesRepository.find({ select: { id: true } });
      return all.map((d) => d.id);
    }
    return (user.devices ?? []).map((d) => d.id);
  }

  private async buildSegments(deviceId: string, fromDate: Date, toDate: Date): Promise<ReportSegment[]> {
    const prevLog = await this.sensorLogsRepository.findOne({
      where: { deviceId, recordedAt: LessThan(fromDate) },
      order: { recordedAt: 'DESC' },
    });

    const logs = await this.sensorLogsRepository.find({
      where: { deviceId, recordedAt: Between(fromDate, toDate) },
      order: { recordedAt: 'ASC' },
    });

    let currentStatus = prevLog?.status ?? 'OFF';
    let cursor = fromDate;
    const segments: ReportSegment[] = [];

    for (const log of logs) {
      if (log.recordedAt <= cursor) {
        currentStatus = log.status;
        continue;
      }

      segments.push(this.makeSegment(cursor, log.recordedAt, currentStatus));
      currentStatus = log.status;
      cursor = log.recordedAt;
    }

    if (cursor < toDate) {
      segments.push(this.makeSegment(cursor, toDate, currentStatus));
    }

    return segments;
  }

  private makeSegment(start: Date, end: Date, status: string): ReportSegment {
    const seconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      durationMinutes: Math.floor(seconds / 60),
      type: status === 'ON' ? 'UPTIME' : 'DOWNTIME',
    };
  }

  private summarizeSegments(segments: ReportSegment[], fromDate: Date, toDate: Date) {
    const uptimeSeconds = segments
      .filter((s) => s.type === 'UPTIME')
      .reduce((sum, s) => sum + s.durationMinutes * 60, 0);
    const downtimeSeconds = segments
      .filter((s) => s.type === 'DOWNTIME')
      .reduce((sum, s) => sum + s.durationMinutes * 60, 0);
    const rangeSeconds = Math.floor((toDate.getTime() - fromDate.getTime()) / 1000);
    const uptimePercentage = rangeSeconds > 0 ? Number(((uptimeSeconds / rangeSeconds) * 100).toFixed(2)) : 0;

    return {
      uptimeSeconds,
      downtimeSeconds,
      uptimePercentage,
    };
  }

  private toDailyBreakdown(segments: ReportSegment[], fromDate: Date, toDate: Date) {
    const days: Record<string, { uptimeSeconds: number; downtimeSeconds: number }> = {};
    const cursor = new Date(fromDate);
    cursor.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(toDate);
    endDay.setUTCHours(0, 0, 0, 0);

    while (cursor <= endDay) {
      const key = cursor.toISOString().slice(0, 10);
      days[key] = { uptimeSeconds: 0, downtimeSeconds: 0 };
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const seg of segments) {
      let start = new Date(seg.start);
      const end = new Date(seg.end);
      while (start < end) {
        const dayKey = start.toISOString().slice(0, 10);
        const nextDay = new Date(start);
        nextDay.setUTCHours(24, 0, 0, 0);
        const sliceEnd = end < nextDay ? end : nextDay;
        const sliceSeconds = Math.floor((sliceEnd.getTime() - start.getTime()) / 1000);
        if (days[dayKey]) {
          if (seg.type === 'UPTIME') days[dayKey].uptimeSeconds += sliceSeconds;
          else days[dayKey].downtimeSeconds += sliceSeconds;
        }
        start = sliceEnd;
      }
    }

    return Object.entries(days).map(([day, values]) => {
      const total = values.uptimeSeconds + values.downtimeSeconds;
      return {
        day,
        uptimeSeconds: values.uptimeSeconds,
        downtimeSeconds: values.downtimeSeconds,
        uptimePercentage: total > 0 ? Number(((values.uptimeSeconds / total) * 100).toFixed(2)) : 0,
      };
    });
  }
}
