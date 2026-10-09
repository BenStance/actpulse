import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { validateNewPassword } from '../../common/security/password';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { accountSummary } from '../users/user-response';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { AuthSessionService } from './auth-session.service';
import {
  invitationHash,
  newInvitationToken,
  newOtp,
  otpHash,
} from './credential-hash';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PasswordOtp } from './password-otp.entity';
import { TokenBlacklist } from './token-blacklist.entity';
import { tokenDigest } from './token-digest';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(PasswordOtp)
    private readonly otps: Repository<PasswordOtp>,
    @InjectRepository(TokenBlacklist)
    private readonly blacklist: Repository<TokenBlacklist>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly sessions: AuthSessionService,
    private readonly rate: AuthRateLimiterService,
  ) {}

  async login(dto: LoginDto, ip: string) {
    const email = dto.email.trim().toLowerCase();
    this.rate.check('login', `${ip}:${email}`);
    const user = await this.users.findOne({
      where: { email },
      relations: ['equipment', 'equipment.monitors', 'organization'],
    });
    if (
      !user ||
      !user.password ||
      !user.isActive ||
      !user.isActivated ||
      (user.organization && !user.organization.isActive) ||
      !(await bcrypt.compare(dto.password, user.password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tokenVersion: user.tokenVersion,
    });
    return { accessToken, user: accountSummary(user) };
  }

  async logout(token: string, userId: string) {
    if (!token) throw new BadRequestException('Missing token');
    const digest = tokenDigest(token);
    if (!(await this.blacklist.exists({ where: { token: digest } }))) {
      await this.blacklist.save(this.blacklist.create({ token: digest }));
    }
    this.sessions.invalidateUser(userId);
    return { message: 'Logged out successfully' };
  }

  async me(userId: string) {
    const user = await this.users.findOneOrFail({
      where: { id: userId },
      relations: ['organization', 'equipment', 'equipment.monitors'],
    });
    return accountSummary(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const name = dto.name.trim();
    if (name.length < 2)
      throw new BadRequestException('Name must have at least two characters');
    await this.users.update(userId, { name });
    return this.me(userId);
  }

  async forgotPassword(dto: ForgotPasswordDto, ip: string) {
    const email = dto.email.trim().toLowerCase();
    this.rate.check('request', `${ip}:${email}`);
    const message = {
      message: 'If the account is eligible, a reset code will be sent',
    };
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.isActive || !user.isActivated) return message;
    const otp = newOtp();
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          PasswordOtp,
          { userId: user.id, purpose: OtpPurpose.FORGOT_PASSWORD, used: false },
          { used: true },
        );
        await manager.save(
          PasswordOtp,
          manager.create(PasswordOtp, {
            userId: user.id,
            email,
            otpCode: otpHash(OtpPurpose.FORGOT_PASSWORD, email, otp),
            purpose: OtpPurpose.FORGOT_PASSWORD,
            token: null,
            expiresAt: new Date(Date.now() + 10 * 60_000),
            used: false,
            failedAttempts: 0,
          }),
        );
        await this.mail.sendOtpReset(email, otp);
      });
    } catch {
      this.logger.error('Password reset delivery failed');
    }
    return message;
  }

  async resetPassword(dto: ResetPasswordDto, ip: string) {
    const email = dto.email.trim().toLowerCase();
    this.rate.check('verify', `${ip}:${email}`);
    validateNewPassword(dto.newPassword);
    const user = await this.users.findOne({ where: { email } });
    if (!user || !user.isActive || !user.isActivated)
      throw new BadRequestException('Invalid or expired code');
    const success = await this.dataSource.transaction(async (manager) => {
      const entry = await manager.getRepository(PasswordOtp).findOne({
        where: {
          userId: user.id,
          purpose: OtpPurpose.FORGOT_PASSWORD,
          used: false,
        },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entry || entry.expiresAt.getTime() < Date.now()) return false;
      const maxAttempts = Number(process.env.AUTH_OTP_MAX_ATTEMPTS ?? 5);
      if (entry.failedAttempts >= maxAttempts) return false;
      if (
        entry.otpCode !== otpHash(OtpPurpose.FORGOT_PASSWORD, email, dto.otp)
      ) {
        entry.failedAttempts += 1;
        if (entry.failedAttempts >= maxAttempts) entry.used = true;
        await manager.save(entry);
        return false;
      }
      await manager.update(User, user.id, {
        password: await bcrypt.hash(dto.newPassword, 12),
        tokenVersion: user.tokenVersion + 1,
      });
      await manager.update(
        PasswordOtp,
        { userId: user.id, purpose: OtpPurpose.FORGOT_PASSWORD, used: false },
        { used: true },
      );
      return true;
    });
    if (!success) throw new BadRequestException('Invalid or expired code');
    this.sessions.invalidateUser(user.id);
    await this.mail
      .sendPasswordChanged(email)
      .catch(() =>
        this.logger.warn('Password-change notice could not be delivered'),
      );
    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    validateNewPassword(dto.newPassword);
    const user = await this.users.findOne({ where: { id: userId } });
    if (
      !user?.password ||
      !(await bcrypt.compare(dto.oldPassword, user.password))
    ) {
      throw new BadRequestException('Current password is incorrect');
    }
    user.password = await bcrypt.hash(dto.newPassword, 12);
    user.tokenVersion += 1;
    await this.users.save(user);
    this.sessions.invalidateUser(userId);
    await this.mail
      .sendPasswordChanged(user.email)
      .catch(() =>
        this.logger.warn('Password-change notice could not be delivered'),
      );
    return { message: 'Password changed successfully. Please login again.' };
  }

  generateActivationToken() {
    return newInvitationToken();
  }
  hashInvitation(token: string) {
    return invitationHash(token);
  }
}
