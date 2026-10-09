import { Device } from '../devices/device.entity';
import { PasswordOtp } from '../auth/password-otp.entity';
import { Organization } from '../organizations/organization.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { Equipment } from '../equipment/equipment.entity';
export declare class User {
    id: string;
    name: string;
    email: string;
    password: string | null;
    role: UserRole;
    organizationId: string | null;
    organization: Organization | null;
    isActive: boolean;
    isActivated: boolean;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
    devices: Device[];
    equipment: Equipment[];
    otps: PasswordOtp[];
}
