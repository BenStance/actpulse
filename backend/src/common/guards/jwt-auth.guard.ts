import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthSessionService } from '../../modules/auth/auth-session.service';
import {
  EntitlementService,
  FeatureKey,
} from '../../modules/billing/entitlement.service';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly sessions: AuthSessionService,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      originalUrl?: string;
      method?: string;
      user?: { sub: string; role: string; organizationId: string | null };
    }>();
    const authorization: string = req.headers.authorization ?? '';
    if (!authorization.startsWith('Bearer '))
      throw new UnauthorizedException('Missing bearer token');
    const { user } = await this.sessions.validate(
      authorization.slice(7).trim(),
    );
    req.user = {
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };
    if (user.role === UserRole.CONTROLLER) {
      const path = (req.originalUrl || '').split('?')[0];
      const exempt =
        path.startsWith('/auth/') ||
        path.startsWith('/billing/') ||
        path.startsWith('/subscriptions/') ||
        path === '/organizations/me' ||
        path.startsWith('/notifications');
      if (!exempt) {
        let feature: FeatureKey | undefined;
        if (path.startsWith('/fuel/'))
          feature = path.includes('/estimates')
            ? 'fuel_estimates'
            : path.includes('/reconciliations') || path.includes('/adjustments')
              ? 'fuel_costs_reconciliation'
              : 'fuel_records';
        else if (path.startsWith('/maintenance')) feature = 'maintenance';
        else if (path.startsWith('/reports'))
          feature = /[?&]format=pdf(?:&|$)/.test(req.originalUrl || '')
            ? 'pdf_export'
            : path.includes('fleet') ||
                /[?&]type=fleet(?:&|$)/.test(req.originalUrl || '')
              ? 'fleet_analytics'
              : path.includes('operations') &&
                  /[?&]type=(costs|reconciliation|maintenance|alerts|fleet)/.test(
                    req.originalUrl || '',
                  )
                ? 'advanced_reports'
                : 'live_monitoring';
        else feature = 'live_monitoring';
        await this.entitlements.assert(user.organizationId, feature);
      }
    }
    return true;
  }
}
