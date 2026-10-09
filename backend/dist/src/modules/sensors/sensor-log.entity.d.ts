import { Device } from '../devices/device.entity';
import { Equipment } from '../equipment/equipment.entity';
import { SensorStatus } from '../../common/enums/sensor-status.enum';
export declare class SensorLog {
    id: string;
    deviceId: string;
    device: Device;
    equipmentId: string;
    equipment: Equipment;
    status: SensorStatus;
    recordedAt: Date;
    receivedAt: Date;
    timestampBasis: 'RECEIVED' | 'DEVICE';
    source: 'DEVICE' | 'SIMULATOR';
    eventId: string | null;
    kind: 'TRANSITION' | 'CONFIRMATION';
}
