import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateEquipmentDto } from './create-equipment.dto';
export class UpdateEquipmentDto extends PartialType(
  OmitType(CreateEquipmentDto, ['organizationId'] as const),
) {}
