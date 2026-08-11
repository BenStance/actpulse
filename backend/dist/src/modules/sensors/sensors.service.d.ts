import { Repository } from 'typeorm';
import { Device } from '../devices/device.entity';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SensorLog } from './sensor-log.entity';
import { SensorStatusDto } from './dto/sensor-status.dto';
export declare class SensorsService {
    private readonly sensorLogRepository;
    private readonly realtimeGateway;
    private readonly heartbeatTimers;
    constructor(sensorLogRepository: Repository<SensorLog>, realtimeGateway: RealtimeGateway);
    pushStatus(device: Device, dto: SensorStatusDto): Promise<{
        message: string;
        logId?: undefined;
    } | {
        message: string;
        logId: string;
    }>;
    heartbeat(device: Device): {
        message: string;
    };
}
