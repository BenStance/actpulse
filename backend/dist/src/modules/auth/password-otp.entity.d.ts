import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { User } from '../users/user.entity';
export declare class PasswordOtp {
    id: string;
    email: string | null;
    otpCode: string;
    token: string | null;
    purpose: OtpPurpose;
    expiresAt: Date;
    used: boolean;
    userId: string | null;
    user: User | null;
    createdAt: Date;
}
