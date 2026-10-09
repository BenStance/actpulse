import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Device } from '../../modules/devices/device.entity';
export declare class DeviceApiKeyGuard implements CanActivate {
    private readonly devices;
    constructor(devices: Repository<Device>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
