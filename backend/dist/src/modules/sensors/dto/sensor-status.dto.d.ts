import { SensorStatus } from '../../../common/enums/sensor-status.enum';
export declare class SensorStatusDto {
    status: SensorStatus;
    eventId?: string;
    observedAt?: string;
    timestamp?: number;
}
