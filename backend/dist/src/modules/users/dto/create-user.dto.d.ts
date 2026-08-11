import { UserRole } from '../../../common/enums/user-role.enum';
export declare class CreateUserDto {
    name: string;
    email: string;
    role: UserRole;
    deviceIds: string[];
}
