import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { Device, DeviceLifecycle } from '../../modules/devices/device.entity';

@Injectable()
export class DeviceApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; device?: Device }>();
    const header = request.headers.authorization ?? '';
    if (!header.startsWith('ApiKey '))
      throw new UnauthorizedException('Invalid device authorization');
    const apiKey = header.slice(7).trim();
    if (apiKey.length < 16 || apiKey.length > 256)
      throw new UnauthorizedException('Invalid device authorization');
    const hash = createHash('sha256').update(apiKey).digest('hex');
    const match = /^ap_([0-9a-f]{16})\.[A-Za-z0-9_-]{40,50}$/.exec(apiKey);
    const device = await this.devices.findOne({
      where: match ? { credentialId: match[1] } : { credentialHash: hash },
      relations: ['organization', 'equipment'],
    });
    if (
      !device?.credentialHash ||
      !timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(device.credentialHash, 'hex'),
      ) ||
      device.lifecycleState !== DeviceLifecycle.ACTIVE ||
      !device.isActive ||
      !device.organization?.isActive ||
      !device.equipment?.isActive ||
      device.currentEquipmentId !== device.equipment.id
    )
      throw new UnauthorizedException('Invalid API key or inactive monitor');
    request.device = device;
    return true;
  }
}
