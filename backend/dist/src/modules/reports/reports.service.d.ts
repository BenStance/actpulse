import { Repository } from 'typeorm';
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
export declare class ReportsService {
    private readonly usersRepository;
    private readonly devicesRepository;
    private readonly sensorLogsRepository;
    constructor(usersRepository: Repository<User>, devicesRepository: Repository<Device>, sensorLogsRepository: Repository<SensorLog>);
    getDeviceUptime(userId: string, deviceId: string, from: string, to: string): Promise<{
        device: {
            id: string;
            name: string;
        };
        period: {
            from: string;
            to: string;
        };
        summary: {
            uptimeSeconds: number;
            downtimeSeconds: number;
            uptimePercentage: number;
        };
        table: ReportSegment[];
    }>;
    getDeviceDaily(userId: string, deviceId: string, from: string, to: string): Promise<{
        day: string;
        uptimeSeconds: number;
        downtimeSeconds: number;
        uptimePercentage: number;
    }[]>;
    getDeviceEvents(userId: string, deviceId: string, from: string, to: string): Promise<{
        deviceId: string;
        period: {
            from: string;
            to: string;
        };
        count: number;
        events: {
            timestamp: string;
            status: string;
            transition: string | null;
        }[];
    }>;
    getFleetSummary(userId: string, from: string, to: string): Promise<{
        period: {
            from: string;
            to: string;
        };
        totals: {
            devices: number;
            uptimeSeconds: number;
            downtimeSeconds: number;
            uptimePercentage: number;
        };
        devices: {
            device: {
                id: string;
                name: string;
            };
            uptimeSeconds: number;
            downtimeSeconds: number;
            uptimePercentage: number;
        }[];
    }>;
    private parseRange;
    private ensureDeviceAccess;
    private resolveAccessibleDeviceIds;
    private buildSegments;
    private makeSegment;
    private summarizeSegments;
    private toDailyBreakdown;
}
export {};
