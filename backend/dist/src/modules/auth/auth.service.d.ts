import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordOtp } from './password-otp.entity';
import { TokenBlacklist } from './token-blacklist.entity';
export declare class AuthService {
    private readonly usersRepository;
    private readonly otpRepository;
    private readonly tokenBlacklistRepository;
    private readonly jwtService;
    private readonly mailService;
    constructor(usersRepository: Repository<User>, otpRepository: Repository<PasswordOtp>, tokenBlacklistRepository: Repository<TokenBlacklist>, jwtService: JwtService, mailService: MailService);
    seedAdmin(): Promise<void>;
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: string;
            deviceIds: string[];
        };
    }>;
    logout(token: string): Promise<{
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<{
        message: string;
    }>;
    private generateOtp;
    generateActivationToken(): string;
}
