import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class AssignDevicesDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  deviceIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  equipmentIds?: string[];
}
