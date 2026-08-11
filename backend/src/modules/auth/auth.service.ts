import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordOtp } from './password-otp.entity';
import { TokenBlacklist } from './token-blacklist.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(PasswordOtp)
    private readonly otpRepository: Repository<PasswordOtp>,
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async seedAdmin(): Promise<void> {
    const email = 'benedict@act-ltd.com';
    const existing = await this.usersRepository.findOne({ where: { email } });
    if (existing) {
      return;
    }

    const passwordHash = await bcrypt.hash('45653211', 10);
    const admin = this.usersRepository.create({
      name: 'Benedict Nsale',
      email,
      password: passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
      isActivated: true,
      tokenVersion: 0,
    });
    await this.usersRepository.save(admin);
  }

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findOne({ where: { email: dto.email }, relations: ['devices'] });
    if (!user || !user.password || !user.isActive || !user.isActivated) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        deviceIds: user.devices.map((d) => d.id),
      },
    };
  }

  async logout(token: string) {
    if (!token) {
      throw new BadRequestException('Missing token');
    }

    const exists = await this.tokenBlacklistRepository.findOne({ where: { token } });
    if (!exists) {
      const blacklisted = this.tokenBlacklistRepository.create({ token });
      await this.tokenBlacklistRepository.save(blacklisted);
    }

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      return { message: 'If user exists, OTP has been sent' };
    }

    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.otpRepository.save(
      this.otpRepository.create({
        userId: user.id,
        email: user.email,
        otpCode: otp,
        purpose: OtpPurpose.FORGOT_PASSWORD,
        token: null,
        expiresAt,
        used: false,
      }),
    );

    await this.mailService.sendOtpReset(user.email, otp);
    return { message: 'If user exists, OTP has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const otpEntry = await this.otpRepository.findOne({
      where: {
        email: dto.email,
        otpCode: dto.otp,
        purpose: OtpPurpose.FORGOT_PASSWORD,
        used: false,
      },
      order: { createdAt: 'DESC' },
    });

    if (!otpEntry || otpEntry.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.tokenVersion += 1;
    await this.usersRepository.save(user);

    otpEntry.used = true;
    await this.otpRepository.save(otpEntry);
    await this.mailService.sendPasswordChanged(user.email);

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user || !user.password) {
      throw new BadRequestException('User not found');
    }

    const match = await bcrypt.compare(dto.oldPassword, user.password);
    if (!match) {
      throw new BadRequestException('Old password is incorrect');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.tokenVersion += 1;
    await this.usersRepository.save(user);

    await this.mailService.sendPasswordChanged(user.email);
    return { message: 'Password changed successfully. Please login again.' };
  }

  private generateOtp(): string {
    return `${randomInt(100000, 999999)}`;
  }

  generateActivationToken(): string {
    return randomBytes(20).toString('hex');
  }
}
