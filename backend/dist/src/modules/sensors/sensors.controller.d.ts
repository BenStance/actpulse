import { Device } from '../devices/device.entity';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { SensorStatusDto } from './dto/sensor-status.dto';
import { SensorsService } from './sensors.service';
export declare class SensorsController {
    private readonly sensorsService;
    constructor(sensorsService: SensorsService);
    pushStatus(device: Device, dto: SensorStatusDto): Promise<{
        message: string;
        logId?: undefined;
    } | {
        message: string;
        logId: string;
    }>;
    heartbeat(device: Device, _dto: HeartbeatDto): {
        message: string;
    };
}
