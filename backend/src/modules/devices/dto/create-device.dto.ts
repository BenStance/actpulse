import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class CreateDeviceDto {
  @IsUUID('4') organizationId!: string;
  @IsUUID('4') siteId!: string;
  @IsUUID('4') equipmentId!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @MinLength(3) @MaxLength(120) deviceIdentifier!: string;
  @IsOptional() @IsString() @MaxLength(160) hardwareModel?: string;
  @IsOptional() @IsString() @MaxLength(100) firmwareVersion?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(3600)
  heartbeatIntervalSeconds?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(86400)
  offlineTimeoutSeconds?: number;
}
