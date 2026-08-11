import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { SensorLog } from '../sensors/sensor-log.entity';
import { User } from '../users/user.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { Device } from './device.entity';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    @InjectRepository(SensorLog)
    private readonly sensorLogsRepository: Repository<SensorLog>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  create(dto: CreateDeviceDto) {
    const device = this.devicesRepository.create({
      ...dto,
      apiKey: this.generateApiKey(),
      isActive: true,
    });
    return this.devicesRepository.save(device);
  }

  async findAll(userId: string) {
    const allowedIds = await this.resolveAccessibleDeviceIds(userId);
    const devices = allowedIds.length
      ? await this.devicesRepository.find({ where: { id: In(allowedIds) }, relations: ['users'] })
      : [];
    return this.attachCurrentStatus(devices);
  }

  async findOne(id: string, userId: string) {
    await this.assertDeviceAccess(userId, id);
    const device = await this.devicesRepository.findOne({ where: { id }, relations: ['users'] });
    if (!device) throw new NotFoundException('Device not found');
    const [withStatus] = await this.attachCurrentStatus([device]);
    return withStatus;
  }

  async update(id: string, dto: UpdateDeviceDto, userId: string) {
    const device = await this.findOne(id, userId);
    Object.assign(device, dto);
    await this.devicesRepository.save(device);
    return this.findOne(id, userId);
  }

  async deactivate(id: string, userId: string) {
    const device = await this.findOne(id, userId);
    device.isActive = false;
    await this.devicesRepository.save(device);
    return { message: 'Device deactivated successfully' };
  }

  async rotateKey(id: string, userId: string) {
    const device = await this.findOne(id, userId);
    device.apiKey = this.generateApiKey();
    await this.devicesRepository.save(device);
    return { id: device.id, apiKey: device.apiKey };
  }

  private generateApiKey() {
    return randomBytes(24).toString('hex');
  }

  private async attachCurrentStatus(devices: Device[]) {
    if (devices.length === 0) return [];

    const deviceIds = devices.map((d) => d.id);
    const logs = await this.sensorLogsRepository.find({
      where: { deviceId: In(deviceIds) },
      order: { recordedAt: 'DESC' },
    });

    const latestByDevice = new Map<string, SensorLog>();
    for (const log of logs) {
      if (!latestByDevice.has(log.deviceId)) {
        latestByDevice.set(log.deviceId, log);
      }
    }

    return devices.map((device) => {
      const latest = latestByDevice.get(device.id);
      return {
        ...device,
        currentStatus: latest?.status ?? 'UNKNOWN',
        lastReadingAt: latest?.recordedAt ?? null,
      };
    });
  }

  private async resolveAccessibleDeviceIds(userId: string): Promise<string[]> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['devices'],
    });
    if (!user) return [];
    if (user.role === UserRole.ADMIN) {
      const all = await this.devicesRepository.find({ select: { id: true } });
      return all.map((d) => d.id);
    }
    return (user.devices ?? []).map((d) => d.id);
  }

  private async assertDeviceAccess(userId: string, deviceId: string) {
    const allowedIds = await this.resolveAccessibleDeviceIds(userId);
    if (!allowedIds.includes(deviceId)) {
      throw new ForbiddenException('You do not have access to this device');
    }
  }
}
