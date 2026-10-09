import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordOtp } from './password-otp.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TokenBlacklist } from './token-blacklist.entity';
import { AuthSessionService } from './auth-session.service';
import { AuthRateLimiterService } from './auth-rate-limiter.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, PasswordOtp, TokenBlacklist]),
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionService,
    AuthRateLimiterService,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    AuthSessionService,
    AuthRateLimiterService,
    JwtModule,
    TypeOrmModule,
  ],
})
export class AuthModule {}
