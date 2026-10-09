import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { TokenBlacklist } from './token-blacklist.entity';
import { tokenDigest } from './token-digest';

type SessionPayload = { sub: string; tokenVersion: number; exp: number };

@Injectable()
export class AuthSessionService {
  readonly invalidated$ = new Subject<string>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(TokenBlacklist)
    private readonly blacklist: Repository<TokenBlacklist>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validate(token: string): Promise<{ user: User; expiresAt: number }> {
    if (!token) throw new UnauthorizedException('Missing bearer token');
    let payload: SessionPayload;
    try {
      payload = await this.jwt.verifyAsync<SessionPayload>(token, {
        secret: this.config.getOrThrow<string>('jwtSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
    if (!payload.sub || !payload.exp)
      throw new UnauthorizedException('Invalid session');
    const [user, revoked] = await Promise.all([
      this.users.findOne({
        where: { id: payload.sub },
        relations: ['organization'],
      }),
      this.blacklist.exists({ where: { token: tokenDigest(token) } }),
    ]);
    if (
      revoked ||
      !user ||
      !user.isActive ||
      !user.isActivated ||
      user.tokenVersion !== payload.tokenVersion ||
      (user.organization && !user.organization.isActive)
    ) {
      throw new UnauthorizedException('Session is no longer active');
    }
    return { user, expiresAt: payload.exp * 1000 };
  }

  invalidateUser(userId: string): void {
    this.invalidated$.next(userId);
  }
}
