import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SensorStatus } from '../../../common/enums/sensor-status.enum';
export class SensorStatusDto {
  @IsEnum(SensorStatus) status!: SensorStatus;
  @IsOptional() @IsString() @MaxLength(120) eventId?: string;
  @IsOptional() @IsISO8601({ strict: true }) observedAt?: string;
  @IsOptional() @IsInt() @Min(1) timestamp?: number; // Legacy Unix seconds.
}
