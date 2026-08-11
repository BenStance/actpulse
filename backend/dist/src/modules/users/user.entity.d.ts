import { Device } from '../devices/device.entity';
import { PasswordOtp } from '../auth/password-otp.entity';
export declare class User {
    id: string;
    name: string;
    email: string;
    password: string | null;
    role: string;
    isActive: boolean;
    isActivated: boolean;
    tokenVersion: number;
    createdAt: Date;
    updatedAt: Date;
    devices: Device[];
    otps: PasswordOtp[];
}
