import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class ActivateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsOptional()
  @IsString()
  token?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
