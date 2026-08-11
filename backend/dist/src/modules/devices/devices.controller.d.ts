import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DevicesService } from './devices.service';
export declare class DevicesController {
    private readonly devicesService;
    constructor(devicesService: DevicesService);
    create(dto: CreateDeviceDto): Promise<import("./device.entity").Device>;
    findAll(req: {
        user: {
            sub: string;
        };
    }): Promise<{
        currentStatus: string;
        lastReadingAt: Date | null;
        id: string;
        name: string;
        location: string;
        apiKey: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sensorLogs: import("../sensors/sensor-log.entity").SensorLog[];
        users: import("../users/user.entity").User[];
    }[]>;
    findOne(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
        currentStatus: string;
        lastReadingAt: Date | null;
        id: string;
        name: string;
        location: string;
        apiKey: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sensorLogs: import("../sensors/sensor-log.entity").SensorLog[];
        users: import("../users/user.entity").User[];
    }>;
    update(id: string, dto: UpdateDeviceDto, req: {
        user: {
            sub: string;
        };
    }): Promise<{
        currentStatus: string;
        lastReadingAt: Date | null;
        id: string;
        name: string;
        location: string;
        apiKey: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        sensorLogs: import("../sensors/sensor-log.entity").SensorLog[];
        users: import("../users/user.entity").User[];
    }>;
    deactivate(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
        message: string;
    }>;
    rotateKey(id: string, req: {
        user: {
            sub: string;
        };
    }): Promise<{
        id: string;
        apiKey: string;
    }>;
}
