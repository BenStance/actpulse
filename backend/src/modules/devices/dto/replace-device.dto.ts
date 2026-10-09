import { OmitType } from '@nestjs/mapped-types';
import { CreateDeviceDto } from './create-device.dto';
export class ReplaceDeviceDto extends OmitType(CreateDeviceDto, [
  'organizationId',
  'siteId',
  'equipmentId',
] as const) {}
