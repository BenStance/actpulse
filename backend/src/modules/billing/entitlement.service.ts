import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

export const featureKeys = [
  'live_monitoring',
  'fuel_records',
  'fuel_estimates',
  'fuel_costs_reconciliation',
  'maintenance',
  'advanced_reports',
  'pdf_export',
  'fleet_analytics',
] as const;
export type FeatureKey = (typeof featureKeys)[number];
export type PlanSnapshot = {
  id: string;
  code: string;
  name: string;
  currency: string;
  siteLimit: number;
  equipmentLimit: number;
  controllerLimit: number;
  features: Record<string, boolean>;
};
export type Entitlement = {
  organizationId: string;
  organizationName: string;
  organizationActive: boolean;
  state: 'NONE' | 'TRIALING' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'SUSPENDED';
  valid: boolean;
  plan: PlanSnapshot | null;
  billingCycle: string | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  paidStartAt: Date | null;
  paidEndAt: Date | null;
  graceEndsAt: Date | null;
  suspensionReason: string | null;
  usage: { sites: number; equipment: number; controllers: number };
};

function denied(code: string, message: string): never {
  throw new ForbiddenException({ code, message });
}

@Injectable()
export class EntitlementService {
  constructor(private readonly db: DataSource) {}
  async status(
    organizationId: string,
    manager: EntityManager = this.db.manager,
  ): Promise<Entitlement> {
    const result: unknown = await manager.query(
      `SELECT o.id,o.name,o.is_active,s.plan_snapshot,s.billing_cycle,s.trial_started_at,s.trial_ends_at,
        s.paid_start_at,s.paid_end_at,s.grace_ends_at,s.state,s.suspension_reason,
        (SELECT count(*)::int FROM sites WHERE organization_id=o.id AND is_active=true) sites,
        (SELECT count(*)::int FROM equipment WHERE organization_id=o.id AND is_active=true) equipment,
        (SELECT count(*)::int FROM users WHERE organization_id=o.id AND role='Controller' AND is_active=true) controllers
       FROM organizations o LEFT JOIN organization_subscriptions s ON s.organization_id=o.id WHERE o.id=$1`,
      [organizationId],
    );
    const [row] = result as Array<Record<string, unknown>>;
    if (!row) denied('SUBSCRIPTION_REQUIRED', 'Organization not found');
    const periodResult: unknown = await manager.query(
      `SELECT starts_at,ends_at,plan_snapshot FROM subscription_periods
       WHERE organization_id=$1 AND kind='PAID' AND starts_at<=now() AND ends_at>now()
       ORDER BY starts_at DESC LIMIT 1`,
      [organizationId],
    );
    const [period] = periodResult as Array<Record<string, unknown>>;
    const trialStart = row.trial_started_at as Date | null;
    const trialEnd = row.trial_ends_at as Date | null;
    const trial =
      trialStart &&
      trialEnd &&
      new Date(trialStart).getTime() <= Date.now() &&
      Date.now() < new Date(trialEnd).getTime();
    const state = !row.plan_snapshot
      ? 'NONE'
      : row.state === 'SUSPENDED'
        ? 'SUSPENDED'
        : period
          ? 'ACTIVE'
          : trial
            ? 'TRIALING'
            : row.grace_ends_at &&
                new Date(row.grace_ends_at as Date).getTime() > Date.now() &&
                row.paid_end_at &&
                new Date(row.paid_end_at as Date).getTime() <= Date.now()
              ? 'GRACE'
              : 'EXPIRED';
    return {
      organizationId,
      organizationName: String(row.name),
      organizationActive: row.is_active === true,
      state,
      valid:
        row.is_active === true &&
        (state === 'ACTIVE' || state === 'TRIALING' || state === 'GRACE'),
      plan: (period?.plan_snapshot ??
        row.plan_snapshot ??
        null) as PlanSnapshot | null,
      billingCycle:
        typeof row.billing_cycle === 'string' ? row.billing_cycle : null,
      trialStartedAt: row.trial_started_at as Date | null,
      trialEndsAt: row.trial_ends_at as Date | null,
      paidStartAt: (period?.starts_at ??
        row.paid_start_at ??
        null) as Date | null,
      paidEndAt: (period?.ends_at ?? row.paid_end_at ?? null) as Date | null,
      graceEndsAt: row.grace_ends_at as Date | null,
      suspensionReason: row.suspension_reason as string | null,
      usage: {
        sites: Number(row.sites),
        equipment: Number(row.equipment),
        controllers: Number(row.controllers),
      },
    };
  }
  async assert(
    organizationId: string | null,
    feature?: FeatureKey,
    manager?: EntityManager,
  ): Promise<Entitlement> {
    if (!organizationId)
      denied('SUBSCRIPTION_REQUIRED', 'Select an organization subscription');
    const status = await this.status(organizationId, manager);
    if (!status.organizationActive || status.state === 'SUSPENDED')
      denied('SUBSCRIPTION_SUSPENDED', 'Organization access is suspended');
    if (status.state === 'NONE')
      denied('SUBSCRIPTION_REQUIRED', 'Select a subscription plan');
    if (!status.valid)
      denied('SUBSCRIPTION_EXPIRED', 'Subscription access has expired');
    if (feature && !status.plan?.features[feature])
      denied('FEATURE_NOT_INCLUDED', `${feature} is not included in this plan`);
    return status;
  }
  async lockAndCheck(
    organizationId: string,
    resource: 'sites' | 'equipment' | 'controllers',
    manager: EntityManager,
  ): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      organizationId,
    ]);
    if (resource === 'controllers') {
      const bootstrap = await this.status(organizationId, manager);
      if (
        bootstrap.organizationActive &&
        bootstrap.state === 'NONE' &&
        bootstrap.usage.controllers === 0
      )
        return;
    }
    const status = await this.assert(
      organizationId,
      'live_monitoring',
      manager,
    );
    const limits = {
      sites: status.plan!.siteLimit,
      equipment: status.plan!.equipmentLimit,
      controllers: status.plan!.controllerLimit,
    };
    if (status.usage[resource] >= limits[resource])
      denied('PLAN_LIMIT_REACHED', `${resource} limit reached`);
  }
  async excess(organizationId: string, plan: PlanSnapshot) {
    const current = await this.status(organizationId);
    return {
      sites: Math.max(0, current.usage.sites - plan.siteLimit),
      equipment: Math.max(0, current.usage.equipment - plan.equipmentLimit),
      controllers: Math.max(
        0,
        current.usage.controllers - plan.controllerLimit,
      ),
    };
  }
}
