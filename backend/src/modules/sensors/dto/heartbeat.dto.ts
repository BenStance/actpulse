import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { SensorStatus } from '../../../common/enums/sensor-status.enum';
export class HeartbeatDto {
  @IsOptional() @IsInt() @Min(1) timestamp?: number;
  @IsOptional() @IsEnum(SensorStatus) status?: SensorStatus;
}
