import { Repository } from 'typeorm';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from './device.entity';
export declare class DevicesService {
    private readonly devicesRepository;
    private readonly sensorLogsRepository;
    private readonly usersRepository;
    constructor(devicesRepository: Repository<Device>, sensorLogsRepository: Repository<SensorLog>, usersRepository: Repository<User>);
    create(dto: CreateDeviceDto): Promise<Device>;
    findAll(userId: string): Promise<{
        currentStatus: string;
        lastReadingAt: Date | null;
        id: string;
        name: string;
        location: string;
        apiKey: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sensorLogs: SensorLog[];
        users: User[];
    }[]>;
    findOne(id: string, userId: string): Promise<{
        currentStatus: string;
        lastReadingAt: Date | null;
        id: string;
        name: string;
        location: string;
        apiKey: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sensorLogs: SensorLog[];
        users: User[];
    }>;
    update(id: string, dto: UpdateDeviceDto, userId: string): Promise<{
        currentStatus: string;
        lastReadingAt: Date | null;
        id: string;
        name: string;
        location: string;
        apiKey: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sensorLogs: SensorLog[];
        users: User[];
    }>;
    deactivate(id: string, userId: string): Promise<{
        message: string;
    }>;
    rotateKey(id: string, userId: string): Promise<{
        id: string;
        apiKey: string;
    }>;
    private generateApiKey;
    private attachCurrentStatus;
    private resolveAccessibleDeviceIds;
    private assertDeviceAccess;
}
