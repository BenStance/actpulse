import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: { ip?: string }) {
    return this.authService.login(dto, req.ip ?? 'unknown');
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(
    @Req() req: { headers: { authorization?: string }; user: { sub: string } },
  ) {
    const token = (req.headers.authorization ?? '')
      .replace('Bearer ', '')
      .trim();
    return this.authService.logout(token, req.user.sub);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: { ip?: string }) {
    return this.authService.forgotPassword(dto, req.ip ?? 'unknown');
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: { ip?: string }) {
    return this.authService.resetPassword(dto, req.ip ?? 'unknown');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: { sub: string } }) {
    return this.authService.me(req.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() req: { user: { sub: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.sub, dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() req: { user: { sub: string } },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, dto);
  }
}
