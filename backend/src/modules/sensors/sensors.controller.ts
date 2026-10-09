import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentDevice } from '../../common/decorators/current-device.decorator';
import { DeviceApiKeyGuard } from '../../common/guards/device-api-key.guard';
import { Device } from '../devices/device.entity';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { SensorStatusDto } from './dto/sensor-status.dto';
import { SensorsService } from './sensors.service';
@Controller('sensors')
@UseGuards(DeviceApiKeyGuard)
export class SensorsController {
  constructor(private readonly sensors: SensorsService) {}
  @Post('status') status(
    @CurrentDevice() device: Device,
    @Body() dto: SensorStatusDto,
  ) {
    return this.sensors.pushStatus(device, dto);
  }
  @Post('heartbeat') heartbeat(
    @CurrentDevice() device: Device,
    @Body() dto: HeartbeatDto,
  ) {
    return this.sensors.heartbeat(device, dto);
  }
}
