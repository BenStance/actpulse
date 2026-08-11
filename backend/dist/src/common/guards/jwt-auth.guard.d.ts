import { ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TokenBlacklist } from '../../modules/auth/token-blacklist.entity';
import { User } from '../../modules/users/user.entity';
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
    private readonly tokenBlacklistRepository;
    private readonly userRepository;
    constructor(tokenBlacklistRepository: Repository<TokenBlacklist>, userRepository: Repository<User>);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export {};
