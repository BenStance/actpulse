import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../modules/devices/device.entity';

@Injectable()
export class DeviceApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorization: string = request.headers.authorization ?? '';
    if (!authorization.startsWith('ApiKey ')) {
      throw new UnauthorizedException('Invalid device authorization scheme');
    }

    const apiKey = authorization.replace('ApiKey ', '').trim();
    const device = await this.devicesRepository.findOne({ where: { apiKey, isActive: true }, relations: ['users'] });
    if (!device) {
      throw new UnauthorizedException('Invalid API key or inactive device');
    }

    request.device = device;
    return true;
  }
}

