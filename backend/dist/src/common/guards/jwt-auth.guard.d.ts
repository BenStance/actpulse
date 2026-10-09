import { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthSessionService } from '../../modules/auth/auth-session.service';
import { EntitlementService } from '../../modules/billing/entitlement.service';
export declare class JwtAuthGuard implements CanActivate {
    private readonly sessions;
    private readonly entitlements;
    constructor(sessions: AuthSessionService, entitlements: EntitlementService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
