import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ActivateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;

  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
