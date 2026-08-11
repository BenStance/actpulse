import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Device } from '../../modules/devices/device.entity';
export declare class DeviceApiKeyGuard implements CanActivate {
    private readonly devicesRepository;
    constructor(devicesRepository: Repository<Device>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
