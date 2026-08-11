import { IsOptional, IsNumber } from 'class-validator';

export class HeartbeatDto {
  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
