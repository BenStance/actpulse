import { Device } from '../devices/device.entity';
import { SensorStatus } from '../../common/enums/sensor-status.enum';
export declare class SensorLog {
    id: string;
    deviceId: string;
    device: Device;
    status: SensorStatus;
    recordedAt: Date;
}
