import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EquipmentType, MonitoringDefinition } from '../equipment.entity';

export class CreateEquipmentDto {
  @IsUUID('4') organizationId!: string;
  @IsUUID('4') siteId!: string;
  @IsEnum(EquipmentType) type!: EquipmentType;
  @IsEnum(MonitoringDefinition) monitoringDefinition!: MonitoringDefinition;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(100) assetTag?: string;
  @IsOptional() @IsString() @MaxLength(160) manufacturer?: string;
  @IsOptional() @IsString() @MaxLength(160) model?: string;
  @IsOptional() @IsString() @MaxLength(160) serialNumber?: string;
  @IsOptional() @IsDateString() installationDate?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  ratedCapacityKva?: number;
  @IsOptional() @IsString() @MaxLength(80) fuelType?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  tankCapacityLitres?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingRunningHours?: number;
  @IsOptional() @IsDateString() openingHoursAt?: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  serviceIntervalHours?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  ratedCapacityKw?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  batteryCapacityAh?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  nominalBatteryVoltage?: number;
  @IsOptional() @IsString() @MaxLength(2000) batteryNotes?: string;
}
