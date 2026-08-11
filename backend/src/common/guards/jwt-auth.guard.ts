import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenBlacklist } from '../../modules/auth/token-blacklist.entity';
import { User } from '../../modules/users/user.entity';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @InjectRepository(TokenBlacklist)
    private readonly tokenBlacklistRepository: Repository<TokenBlacklist>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const active = await super.canActivate(context);
    if (!active) {
      return false;
    }

    const req = context.switchToHttp().getRequest();
    const authHeader: string = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const blacklisted = await this.tokenBlacklistRepository.findOne({ where: { token } });
    if (blacklisted) {
      throw new UnauthorizedException('Token has been invalidated');
    }

    const user = await this.userRepository.findOne({ where: { id: req.user?.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not active');
    }

    if ((req.user?.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Session expired');
    }

    return true;
  }
}
