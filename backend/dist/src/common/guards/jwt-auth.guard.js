"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const auth_session_service_1 = require("../../modules/auth/auth-session.service");
const entitlement_service_1 = require("../../modules/billing/entitlement.service");
const user_role_enum_1 = require("../enums/user-role.enum");
let JwtAuthGuard = class JwtAuthGuard {
    sessions;
    entitlements;
    constructor(sessions, entitlements) {
        this.sessions = sessions;
        this.entitlements = entitlements;
    }
    async canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const authorization = req.headers.authorization ?? '';
        if (!authorization.startsWith('Bearer '))
            throw new common_1.UnauthorizedException('Missing bearer token');
        const { user } = await this.sessions.validate(authorization.slice(7).trim());
        req.user = {
            sub: user.id,
            role: user.role,
            organizationId: user.organizationId,
        };
        if (user.role === user_role_enum_1.UserRole.CONTROLLER) {
            const path = (req.originalUrl || '').split('?')[0];
            const exempt = path.startsWith('/auth/') ||
                path.startsWith('/billing/') ||
                path.startsWith('/subscriptions/') ||
                path === '/organizations/me' ||
                path.startsWith('/notifications');
            if (!exempt) {
                let feature;
                if (path.startsWith('/fuel/'))
                    feature = path.includes('/estimates')
                        ? 'fuel_estimates'
                        : path.includes('/reconciliations') || path.includes('/adjustments')
                            ? 'fuel_costs_reconciliation'
                            : 'fuel_records';
                else if (path.startsWith('/maintenance'))
                    feature = 'maintenance';
                else if (path.startsWith('/reports'))
                    feature = /[?&]format=pdf(?:&|$)/.test(req.originalUrl || '')
                        ? 'pdf_export'
                        : path.includes('fleet') ||
                            /[?&]type=fleet(?:&|$)/.test(req.originalUrl || '')
                            ? 'fleet_analytics'
                            : path.includes('operations') &&
                                /[?&]type=(costs|reconciliation|maintenance|alerts|fleet)/.test(req.originalUrl || '')
                                ? 'advanced_reports'
                                : 'live_monitoring';
                else
                    feature = 'live_monitoring';
                await this.entitlements.assert(user.organizationId, feature);
            }
        }
        return true;
    }
};
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_session_service_1.AuthSessionService,
        entitlement_service_1.EntitlementService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map