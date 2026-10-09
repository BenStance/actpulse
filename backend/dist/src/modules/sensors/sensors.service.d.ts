import { DataSource, Repository } from 'typeorm';
import { Device } from '../devices/device.entity';
import { ConnectivityService } from '../monitoring/connectivity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SensorLog } from './sensor-log.entity';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { SensorStatusDto } from './dto/sensor-status.dto';
export declare class SensorsService {
    private readonly logs;
    private readonly dataSource;
    private readonly connectivity;
    private readonly realtime;
    constructor(logs: Repository<SensorLog>, dataSource: DataSource, connectivity: ConnectivityService, realtime: RealtimeGateway);
    pushStatus(device: Device, dto: SensorStatusDto, source?: 'DEVICE' | 'SIMULATOR'): Promise<{
        message: string;
        logId: string | null;
        kind: string;
    }>;
    heartbeat(device: Device, dto: HeartbeatDto): Promise<{
        message: string;
        logId: string | null;
        kind: string;
    } | {
        message: string;
        connectivity: string;
        equipmentStateConfirmed: boolean;
    }>;
    private observedAt;
    private touch;
}
