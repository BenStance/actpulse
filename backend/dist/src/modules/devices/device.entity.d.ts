import { User } from '../users/user.entity';
import { SensorLog } from '../sensors/sensor-log.entity';
export declare class Device {
    id: string;
    name: string;
    location: string;
    apiKey: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    sensorLogs: SensorLog[];
    users: User[];
}
