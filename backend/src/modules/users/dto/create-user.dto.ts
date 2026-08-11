import { IsArray, IsEmail, IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '../../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsArray()
  @IsUUID('4', { each: true })
  deviceIds!: string[];
}
