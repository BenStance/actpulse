import { IsEnum, IsOptional, IsNumber } from 'class-validator';
import { SensorStatus } from '../../../common/enums/sensor-status.enum';

export class SensorStatusDto {
  @IsEnum(SensorStatus)
  status!: SensorStatus;

  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
