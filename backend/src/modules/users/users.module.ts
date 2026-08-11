import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasswordOtp } from '../auth/password-otp.entity';
import { TokenBlacklist } from '../auth/token-blacklist.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { Device } from '../devices/device.entity';
import { MailModule } from '../mail/mail.module';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Device, PasswordOtp, TokenBlacklist]),
    forwardRef(() => AuthModule),
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard, RolesGuard],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}

