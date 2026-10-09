import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { AuthSessionService } from './auth-session.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PasswordOtp } from './password-otp.entity';
import { TokenBlacklist } from './token-blacklist.entity';
export declare class AuthService {
    private readonly users;
    private readonly otps;
    private readonly blacklist;
    private readonly dataSource;
    private readonly jwt;
    private readonly mail;
    private readonly sessions;
    private readonly rate;
    private readonly logger;
    constructor(users: Repository<User>, otps: Repository<PasswordOtp>, blacklist: Repository<TokenBlacklist>, dataSource: DataSource, jwt: JwtService, mail: MailService, sessions: AuthSessionService, rate: AuthRateLimiterService);
    login(dto: LoginDto, ip: string): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("../../common/enums/user-role.enum").UserRole;
            organizationId: string | null;
            isActive: boolean;
            isActivated: boolean;
            organization: {
                id: string;
                name: string;
                isActive: boolean;
            } | null;
            equipmentIds: string[];
            deviceIds: string[];
        };
    }>;
    logout(token: string, userId: string): Promise<{
        message: string;
    }>;
    me(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        role: import("../../common/enums/user-role.enum").UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    updateProfile(userId: string, dto: UpdateProfileDto): Promise<{
        id: string;
        name: string;
        email: string;
        role: import("../../common/enums/user-role.enum").UserRole;
        organizationId: string | null;
        isActive: boolean;
        isActivated: boolean;
        organization: {
            id: string;
            name: string;
            isActive: boolean;
        } | null;
        equipmentIds: string[];
        deviceIds: string[];
    }>;
    forgotPassword(dto: ForgotPasswordDto, ip: string): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto, ip: string): Promise<{
        message: string;
    }>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    generateActivationToken(): string;
    hashInvitation(token: string): string;
}
