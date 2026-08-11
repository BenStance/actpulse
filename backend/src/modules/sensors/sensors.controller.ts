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
  constructor(private readonly sensorsService: SensorsService) {}

  @Post('status')
  pushStatus(@CurrentDevice() device: Device, @Body() dto: SensorStatusDto) {
    return this.sensorsService.pushStatus(device, dto);
  }

  @Post('heartbeat')
  heartbeat(@CurrentDevice() device: Device, @Body() _dto: HeartbeatDto) {
    return this.sensorsService.heartbeat(device);
  }
}
