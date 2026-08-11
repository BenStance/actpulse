import { Repository } from 'typeorm';
import { SensorStatus } from '../../common/enums/sensor-status.enum';
import { Device } from '../devices/device.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';
export declare class DashboardService {
    private readonly usersRepository;
    private readonly devicesRepository;
    private readonly sensorLogsRepository;
    constructor(usersRepository: Repository<User>, devicesRepository: Repository<Device>, sensorLogsRepository: Repository<SensorLog>);
    getSummary(userId: string): Promise<{
        totalDevices: number;
        activeDevices: number;
        onlineDevices: number;
        onCount: number;
        offCount: number;
    }>;
    getUptime(userId: string): Promise<{
        [x: string]: string | number;
        day: string;
    }[]>;
    getDowntime(userId: string): Promise<{
        [x: string]: string | number;
        day: string;
    }[]>;
    getActivity(userId: string): Promise<{
        id: string;
        deviceId: string;
        deviceName: string;
        status: SensorStatus;
        recordedAt: Date;
    }[]>;
    private getRecentLogs;
    private toDailySeries;
    private resolveDeviceIds;
}
