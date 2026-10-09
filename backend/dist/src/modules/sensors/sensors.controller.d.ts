import { Device } from '../devices/device.entity';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { SensorStatusDto } from './dto/sensor-status.dto';
import { SensorsService } from './sensors.service';
export declare class SensorsController {
    private readonly sensors;
    constructor(sensors: SensorsService);
    status(device: Device, dto: SensorStatusDto): Promise<{
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
}
