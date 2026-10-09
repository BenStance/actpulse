import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MonitoringService } from '../monitoring/monitoring.service';
import { DashboardService } from './dashboard.service';
import { EquipmentType } from '../equipment/equipment.entity';
import { MonitoringDefinition } from '../equipment/equipment.entity';

type Filters = {
  preset?: string;
  from?: string;
  to?: string;
  timezone?: string;
  organizationId?: string;
  siteId?: string;
  currency?: string;
  orgPage?: string;
  equipmentPage?: string;
  pageSize?: string;
};
type Row = Record<string, unknown>;
type OrganizationRow = Row & {
  id: string;
  name: string;
  administrative_status: string;
  subscription_status: string;
  plan_snapshot: {
    code: string;
    siteLimit: number;
    equipmentLimit: number;
    controllerLimit: number;
  } | null;
  billing_cycle: string | null;
  access_ends_at: Date | null;
  covered_after_end: boolean;
  sites: number;
  equipment: number;
  controllers: number;
  outstanding_by_currency: Array<{ currency: string; amount: string }>;
  pending_payments: number;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function page(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 1;
}
function scopedId(value: unknown, label: string): string | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !uuid.test(value))
    throw new BadRequestException(`Invalid ${label}`);
  return value;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly db: DataSource,
    private readonly monitoring: MonitoringService,
    private readonly dashboard: DashboardService,
  ) {}

  private async rows<T extends Row>(
    sql: string,
    args: unknown[] = [],
  ): Promise<T[]> {
    return await this.db.query(sql, args);
  }

  async overview(adminId: string, filters: Filters = {}) {
    const organizationId = scopedId(filters.organizationId, 'organization');
    const siteId = scopedId(filters.siteId, 'site');
    const currency = filters.currency?.trim().toUpperCase() || null;
    if (currency && !/^[A-Z]{3}$/.test(currency))
      throw new BadRequestException('Use a three-letter currency');
    const period = this.monitoring.resolvePeriod(
      filters,
      'Africa/Dar_es_Salaam',
    );
    const args = [organizationId, period.from, period.to, currency];
    const orgPage = page(filters.orgPage);
    const equipmentPage = page(filters.equipmentPage);
    const pageSize = Math.min(50, page(filters.pageSize || '10'));

    const organizationSql = `SELECT o.id,o.name,o.is_active,o.created_at,
      CASE WHEN o.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END administrative_status,
      CASE WHEN s.organization_id IS NULL THEN 'NONE'
        WHEN s.state='SUSPENDED' THEN 'SUSPENDED'
        WHEN paid.id IS NOT NULL THEN 'ACTIVE'
        WHEN s.trial_started_at<=now() AND s.trial_ends_at>now() THEN 'TRIALING'
        WHEN s.paid_end_at<=now() AND s.grace_ends_at>now() THEN 'GRACE'
        ELSE 'EXPIRED' END subscription_status,
      coalesce(paid.plan_snapshot,s.plan_snapshot) plan_snapshot,s.billing_cycle,
      s.trial_started_at,s.trial_ends_at,coalesce(paid.starts_at,s.paid_start_at) paid_start_at,
      coalesce(paid.ends_at,s.paid_end_at) paid_end_at,
      CASE WHEN paid.id IS NOT NULL THEN paid.ends_at
        WHEN s.trial_started_at<=now() AND s.trial_ends_at>now() THEN s.trial_ends_at
        WHEN s.paid_end_at<=now() AND s.grace_ends_at>now() THEN s.grace_ends_at
        ELSE coalesce(s.paid_end_at,s.trial_ends_at) END access_ends_at,
      EXISTS(SELECT 1 FROM subscription_periods next_period WHERE next_period.organization_id=o.id
        AND next_period.kind='PAID' AND next_period.starts_at<=coalesce(paid.ends_at,s.trial_ends_at)
        AND next_period.ends_at>coalesce(paid.ends_at,s.trial_ends_at)) covered_after_end,
      (SELECT count(*)::int FROM sites WHERE organization_id=o.id AND is_active=true) sites,
      (SELECT count(*)::int FROM equipment WHERE organization_id=o.id AND is_active=true) equipment,
      (SELECT count(*)::int FROM users WHERE organization_id=o.id AND role='Controller' AND is_active=true) controllers,
      (SELECT count(*)::int FROM payment_submissions WHERE organization_id=o.id AND status='PENDING_REVIEW' AND ($2::text IS NULL OR currency=$2)) pending_payments,
      coalesce((SELECT jsonb_agg(jsonb_build_object('currency',balances.currency,'amount',balances.amount)) FROM (
        SELECT i.currency,sum(i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0))::text amount
        FROM invoices i WHERE i.organization_id=o.id AND i.status NOT IN ('PAID','VOID') AND ($2::text IS NULL OR i.currency=$2) GROUP BY i.currency
      ) balances),'[]'::jsonb) outstanding_by_currency
      FROM organizations o LEFT JOIN organization_subscriptions s ON s.organization_id=o.id
      LEFT JOIN LATERAL (SELECT p.* FROM subscription_periods p WHERE p.organization_id=o.id AND p.kind='PAID'
        AND p.starts_at<=now() AND p.ends_at>now() ORDER BY p.starts_at DESC LIMIT 1) paid ON true
      WHERE ($1::uuid IS NULL OR o.id=$1)`;

    const [
      organizations,
      billing,
      trends,
      methods,
      invoiceStates,
      ageing,
      paymentQueue,
      overdueInvoices,
      alertCounts,
      criticalAlerts,
      serviceSummary,
      serviceCosts,
      fuelSummary,
      fuelCosts,
      fuelReview,
      organizationGrowth,
      lifecyclePeriod,
      recentActivity,
      organizationCreated,
      recentServices,
      alertGroups,
      fuelSpendingByLocation,
      operational,
    ] = await Promise.all([
      this.rows<OrganizationRow>(organizationSql, [organizationId, currency]),
      this.rows<Row>(
        `WITH currencies AS (
        SELECT DISTINCT currency FROM invoices WHERE ($1::uuid IS NULL OR organization_id=$1)
        UNION SELECT DISTINCT currency FROM payment_submissions WHERE ($1::uuid IS NULL OR organization_id=$1)
      ) SELECT c.currency,
        (SELECT coalesce(sum(i.total),0)::text FROM invoices i WHERE i.currency=c.currency AND i.status<>'VOID' AND i.issued_at>=$2 AND i.issued_at<$3 AND ($1::uuid IS NULL OR i.organization_id=$1)) issued,
        (SELECT coalesce(sum(a.amount),0)::text FROM payment_allocations a JOIN invoices i ON i.id=a.invoice_id WHERE i.currency=c.currency AND a.allocated_at>=$2 AND a.allocated_at<$3 AND ($1::uuid IS NULL OR i.organization_id=$1)) collected,
        (SELECT count(*)::int FROM payment_submissions p WHERE p.currency=c.currency AND p.status='APPROVED' AND p.reviewed_at>=$2 AND p.reviewed_at<$3 AND ($1::uuid IS NULL OR p.organization_id=$1)) approved_count,
        (SELECT count(*)::int FROM payment_submissions p WHERE p.currency=c.currency AND p.status='REJECTED' AND p.reviewed_at>=$2 AND p.reviewed_at<$3 AND ($1::uuid IS NULL OR p.organization_id=$1)) rejected_count,
        (SELECT count(*)::int FROM payment_submissions p WHERE p.currency=c.currency AND p.status='PENDING_REVIEW' AND ($1::uuid IS NULL OR p.organization_id=$1)) pending_count,
        (SELECT coalesce(sum(i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0)),0)::text FROM invoices i WHERE i.currency=c.currency AND i.status NOT IN ('PAID','VOID') AND ($1::uuid IS NULL OR i.organization_id=$1)) outstanding,
        (SELECT coalesce(sum(i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0)),0)::text FROM invoices i WHERE i.currency=c.currency AND i.status NOT IN ('PAID','VOID') AND i.due_at<now() AND ($1::uuid IS NULL OR i.organization_id=$1)) overdue,
        (SELECT coalesce(sum(p.claimed_amount),0)::text FROM payment_submissions p WHERE p.currency=c.currency AND p.status='PENDING_REVIEW' AND ($1::uuid IS NULL OR p.organization_id=$1)) pending_claimed
        FROM currencies c WHERE ($4::text IS NULL OR c.currency=$4) ORDER BY c.currency`,
        args,
      ),
      this.rows<Row>(
        `SELECT day,currency,sum(issued)::text issued,sum(collected)::text collected FROM (
        SELECT (i.issued_at AT TIME ZONE $5)::date::text AS day,i.currency,sum(i.total) issued,0::numeric collected FROM invoices i
        WHERE i.status<>'VOID' AND i.issued_at>=$2 AND i.issued_at<$3 AND ($1::uuid IS NULL OR i.organization_id=$1) AND ($4::text IS NULL OR i.currency=$4)
        GROUP BY 1,i.currency
        UNION ALL
        SELECT (a.allocated_at AT TIME ZONE $5)::date::text AS day,i.currency,0::numeric,sum(a.amount) collected FROM payment_allocations a JOIN invoices i ON i.id=a.invoice_id
        WHERE a.allocated_at>=$2 AND a.allocated_at<$3 AND ($1::uuid IS NULL OR i.organization_id=$1) AND ($4::text IS NULL OR i.currency=$4)
        GROUP BY 1,i.currency
      ) t GROUP BY day,currency ORDER BY day,currency`,
        [...args, period.timezone],
      ),
      this.rows<Row>(
        `SELECT p.currency,p.method,sum(a.amount)::text collected FROM payment_allocations a JOIN payment_submissions p ON p.id=a.submission_id
        WHERE a.allocated_at>=$2 AND a.allocated_at<$3 AND ($1::uuid IS NULL OR p.organization_id=$1) AND ($4::text IS NULL OR p.currency=$4)
        GROUP BY p.currency,p.method ORDER BY p.currency,p.method`,
        args,
      ),
      this.rows<Row>(
        `SELECT i.currency,i.status,count(*)::int count FROM invoices i WHERE ($1::uuid IS NULL OR i.organization_id=$1) AND ($2::text IS NULL OR i.currency=$2) GROUP BY i.currency,i.status ORDER BY i.currency,i.status`,
        [organizationId, currency],
      ),
      this.rows<Row>(
        `SELECT i.currency,CASE WHEN i.due_at>=now() THEN 'NOT_DUE' WHEN i.due_at>=now()-interval '30 days' THEN '1_30' WHEN i.due_at>=now()-interval '60 days' THEN '31_60' WHEN i.due_at>=now()-interval '90 days' THEN '61_90' ELSE 'OVER_90' END bucket,
        sum(i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0))::text amount
        FROM invoices i WHERE i.status NOT IN ('PAID','VOID') AND ($1::uuid IS NULL OR i.organization_id=$1) AND ($2::text IS NULL OR i.currency=$2)
        GROUP BY i.currency,bucket ORDER BY i.currency,bucket`,
        [organizationId, currency],
      ),
      this.rows<Row>(
        `SELECT p.id,p.organization_id,o.name organization_name,p.invoice_id,i.invoice_number,i.plan_snapshot,i.billing_cycle,i.total,i.currency,p.claimed_amount,p.method,p.reference,p.created_at,p.status,p.duplicate_warning,
        (i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0))::text outstanding
        FROM payment_submissions p JOIN invoices i ON i.id=p.invoice_id JOIN organizations o ON o.id=p.organization_id
        WHERE p.status='PENDING_REVIEW' AND ($1::uuid IS NULL OR p.organization_id=$1) AND ($2::text IS NULL OR p.currency=$2)
        ORDER BY p.created_at ASC LIMIT 10`,
        [organizationId, currency],
      ),
      this.rows<Row>(
        `SELECT i.id,i.organization_id,o.name organization_name,i.invoice_number,i.currency,i.due_at,
        (i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0))::text outstanding
        FROM invoices i JOIN organizations o ON o.id=i.organization_id WHERE i.status NOT IN ('PAID','VOID') AND i.due_at<now()
        AND ($1::uuid IS NULL OR i.organization_id=$1) AND ($2::text IS NULL OR i.currency=$2) ORDER BY i.due_at LIMIT 10`,
        [organizationId, currency],
      ),
      this.rows<Row>(
        `SELECT count(*) FILTER (WHERE a.status='OPEN')::int open,count(*) FILTER (WHERE a.status='ACKNOWLEDGED')::int acknowledged,
        count(*) FILTER (WHERE a.status='RESOLVED' AND a.resolved_at>=$2 AND a.resolved_at<$3)::int resolved_period,
        count(*) FILTER (WHERE a.status<>'RESOLVED' AND a.severity='CRITICAL')::int critical
        FROM alerts a JOIN equipment e ON e.id=a.equipment_id WHERE ($1::uuid IS NULL OR a.organization_id=$1) AND ($4::uuid IS NULL OR e.site_id=$4)`,
        [organizationId, period.from, period.to, siteId],
      ),
      this.rows<Row>(
        `SELECT a.id,a.organization_id,o.name organization_name,a.equipment_id,e.name equipment_name,a.type,a.severity,a.message,a.triggered_at,a.status
        FROM alerts a JOIN equipment e ON e.id=a.equipment_id JOIN organizations o ON o.id=a.organization_id
        WHERE a.status<>'RESOLVED' AND a.severity='CRITICAL' AND ($1::uuid IS NULL OR a.organization_id=$1) AND ($2::uuid IS NULL OR e.site_id=$2)
        ORDER BY a.triggered_at DESC LIMIT 10`,
        [organizationId, siteId],
      ),
      this.rows<Row>(
        `SELECT count(*)::int completed FROM service_records s JOIN equipment e ON e.id=s.equipment_id
        WHERE s.voided_at IS NULL AND s.performed_at>=$2 AND s.performed_at<$3 AND ($1::uuid IS NULL OR e.organization_id=$1) AND ($4::uuid IS NULL OR e.site_id=$4)`,
        [organizationId, period.from, period.to, siteId],
      ),
      this.rows<Row>(
        `SELECT s.currency,sum(s.cost)::text amount FROM service_records s JOIN equipment e ON e.id=s.equipment_id
        WHERE s.voided_at IS NULL AND s.cost IS NOT NULL AND s.performed_at>=$2 AND s.performed_at<$3 AND ($1::uuid IS NULL OR e.organization_id=$1) AND ($5::uuid IS NULL OR e.site_id=$5)
        AND ($4::text IS NULL OR s.currency=$4) GROUP BY s.currency ORDER BY s.currency`,
        [...args, siteId],
      ),
      this.rows<Row>(
        `SELECT count(*) FILTER (WHERE r.status='DRAFT')::int draft,
        count(*) FILTER (WHERE r.status='FINALIZED' AND r.review_flag IS NOT NULL)::int flagged
        FROM fuel_reconciliations r JOIN fuel_tanks t ON t.id=r.tank_id JOIN equipment e ON e.id=t.generator_id
        WHERE ($1::uuid IS NULL OR e.organization_id=$1) AND ($2::uuid IS NULL OR e.site_id=$2)`,
        [organizationId, siteId],
      ),
      this.rows<Row>(
        `SELECT f.currency,sum(f.total_amount)::text amount,sum(f.quantity_litres)::text litres FROM fuel_refills f
        JOIN fuel_tanks t ON t.id=f.tank_id JOIN equipment e ON e.id=t.generator_id
        WHERE f.voided_at IS NULL AND f.occurred_at>=$2 AND f.occurred_at<$3 AND f.currency IS NOT NULL
        AND ($1::uuid IS NULL OR e.organization_id=$1) AND ($5::uuid IS NULL OR e.site_id=$5) AND ($4::text IS NULL OR f.currency=$4)
        GROUP BY f.currency ORDER BY f.currency`,
        [...args, siteId],
      ),
      this.rows<Row>(
        `SELECT coalesce(sum(f.quantity_litres),0)::text purchased_litres FROM fuel_refills f
        JOIN fuel_tanks t ON t.id=f.tank_id JOIN equipment e ON e.id=t.generator_id
        WHERE f.voided_at IS NULL AND f.occurred_at>=$2 AND f.occurred_at<$3
        AND ($1::uuid IS NULL OR e.organization_id=$1) AND ($4::uuid IS NULL OR e.site_id=$4)`,
        [organizationId, period.from, period.to, siteId],
      ),
      this.rows<Row>(
        `SELECT (o.created_at AT TIME ZONE $4)::date::text AS day,count(*)::int organizations FROM organizations o
        WHERE o.created_at>=$2 AND o.created_at<$3 AND ($1::uuid IS NULL OR o.id=$1) GROUP BY day ORDER BY day`,
        [organizationId, period.from, period.to, period.timezone],
      ),
      this.rows<Row>(
        `SELECT
        (SELECT count(*)::int FROM organizations o WHERE o.created_at>=$2 AND o.created_at<$3 AND ($1::uuid IS NULL OR o.id=$1)) new_organizations,
        (SELECT count(*)::int FROM organization_subscriptions s WHERE s.trial_started_at>=$2 AND s.trial_started_at<$3 AND ($1::uuid IS NULL OR s.organization_id=$1)) trials_started,
        (SELECT count(*)::int FROM subscription_periods p WHERE p.kind='PAID' AND p.approved_at>=$2 AND p.approved_at<$3 AND ($1::uuid IS NULL OR p.organization_id=$1)
          AND NOT EXISTS(SELECT 1 FROM subscription_periods older WHERE older.organization_id=p.organization_id AND older.kind='PAID' AND older.id<>p.id AND older.approved_at<p.approved_at)) first_paid,
        (SELECT count(*)::int FROM subscription_periods p WHERE p.kind='PAID' AND p.approved_at>=$2 AND p.approved_at<$3 AND ($1::uuid IS NULL OR p.organization_id=$1)
          AND EXISTS(SELECT 1 FROM subscription_periods older WHERE older.organization_id=p.organization_id AND older.kind='PAID' AND older.id<>p.id AND older.approved_at<p.approved_at)) renewals`,
        [organizationId, period.from, period.to],
      ),
      this.rows<Row>(
        `SELECT a.id,a.occurred_at,a.actor_user_id,u.name actor_name,a.organization_id,o.name organization_name,a.action kind,a.entity_type,a.entity_id
        FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN organizations o ON o.id=a.organization_id
        WHERE a.occurred_at>=$2 AND a.occurred_at<$3 AND ($1::uuid IS NULL OR a.organization_id=$1)
        AND a.action IN ('TRIAL_STARTED','PAYMENT_SUBMITTED','PAYMENT_APPROVED','PAYMENT_REJECTED','SUBSCRIPTION_ACTIVATED','RECONCILIATION_FINALIZED','SERVICE_CORRECTED','SERVICE_VOIDED')
        ORDER BY a.occurred_at DESC LIMIT 20`,
        [organizationId, period.from, period.to],
      ),
      this.rows<Row>(
        `SELECT o.id,o.id organization_id,o.name organization_name,o.created_at occurred_at,
        'ORGANIZATION_CREATED'::text kind FROM organizations o WHERE o.created_at>=$2 AND o.created_at<$3
        AND ($1::uuid IS NULL OR o.id=$1) ORDER BY o.created_at DESC LIMIT 20`,
        [organizationId, period.from, period.to],
      ),
      this.rows<Row>(
        `SELECT s.id,s.equipment_id,e.name equipment_name,o.name organization_name,s.performed_at,s.description,s.cost,s.currency
        FROM service_records s JOIN equipment e ON e.id=s.equipment_id JOIN organizations o ON o.id=e.organization_id
        WHERE s.voided_at IS NULL AND s.performed_at>=$2 AND s.performed_at<$3
        AND ($1::uuid IS NULL OR e.organization_id=$1) AND ($4::uuid IS NULL OR e.site_id=$4)
        ORDER BY s.performed_at DESC LIMIT 10`,
        [organizationId, period.from, period.to, siteId],
      ),
      this.rows<Row>(
        `SELECT a.type,a.severity,a.status,count(*)::int count FROM alerts a JOIN equipment e ON e.id=a.equipment_id
        WHERE ($1::uuid IS NULL OR a.organization_id=$1) AND ($2::uuid IS NULL OR e.site_id=$2)
        GROUP BY a.type,a.severity,a.status ORDER BY count DESC`,
        [organizationId, siteId],
      ),
      this.rows<Row>(
        `SELECT o.id organization_id,o.name organization_name,site.id site_id,site.name site_name,f.currency,
        sum(f.total_amount)::text amount,sum(f.quantity_litres)::text litres
        FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id JOIN equipment e ON e.id=t.generator_id
        JOIN sites site ON site.id=e.site_id JOIN organizations o ON o.id=e.organization_id
        WHERE f.voided_at IS NULL AND f.occurred_at>=$2 AND f.occurred_at<$3 AND f.currency IS NOT NULL
        AND ($1::uuid IS NULL OR o.id=$1) AND ($4::text IS NULL OR f.currency=$4)
        AND ($5::uuid IS NULL OR site.id=$5) GROUP BY o.id,o.name,site.id,site.name,f.currency ORDER BY sum(f.total_amount) DESC LIMIT 20`,
        [...args, siteId],
      ),
      this.dashboard.overview(adminId, {
        ...filters,
        organizationId: organizationId || undefined,
        siteId: siteId || undefined,
        timezone: period.timezone,
        active: true,
      }),
    ]);

    const state = (row: OrganizationRow) =>
      row.administrative_status === 'INACTIVE'
        ? 'INACTIVE'
        : row.subscription_status;
    const states = {
      ACTIVE: 0,
      TRIALING: 0,
      GRACE: 0,
      EXPIRED: 0,
      SUSPENDED: 0,
      NONE: 0,
      INACTIVE: 0,
    };
    const byPlan = new Map<string, number>();
    const byCycle = new Map<string, number>();
    let approachingLimits = 0;
    for (const row of organizations) {
      states[state(row) as keyof typeof states] += 1;
      if (row.plan_snapshot)
        byPlan.set(
          row.plan_snapshot.code,
          (byPlan.get(row.plan_snapshot.code) || 0) + 1,
        );
      if (row.billing_cycle)
        byCycle.set(
          row.billing_cycle,
          (byCycle.get(row.billing_cycle) || 0) + 1,
        );
      const plan = row.plan_snapshot;
      if (
        plan &&
        (
          [
            ['sites', plan.siteLimit],
            ['equipment', plan.equipmentLimit],
            ['controllers', plan.controllerLimit],
          ] as const
        ).some(([key, limit]) => limit > 0 && Number(row[key]) / limit >= 0.8)
      )
        approachingLimits += 1;
    }
    const upcoming = organizations
      .filter(
        (row) =>
          row.administrative_status === 'ACTIVE' &&
          !row.covered_after_end &&
          ['ACTIVE', 'TRIALING', 'GRACE'].includes(row.subscription_status) &&
          row.access_ends_at &&
          new Date(row.access_ends_at).getTime() <= Date.now() + 7 * 86400000,
      )
      .sort(
        (a, b) =>
          new Date(a.access_ends_at!).getTime() -
          new Date(b.access_ends_at!).getTime(),
      )
      .slice(0, 10);
    const cohort = organizations.filter(
      (row) =>
        row.trial_started_at &&
        new Date(row.trial_started_at as Date) >= period.from &&
        new Date(row.trial_started_at as Date) < period.to,
    );
    const converted = cohort.filter(
      (row) => row.paid_start_at || row.paid_end_at,
    ).length;
    const incompleteFollowUp = cohort.filter(
      (row) => new Date(row.trial_ends_at as Date) > new Date(),
    ).length;
    const detail = operational.comparison.map((row) => ({
      ...row,
      organizationName:
        organizations.find((org) => org.id === row.organizationId)?.name ||
        'Organization',
    }));
    const siteHours = new Map<
      string,
      { site: string; onHours: number; offHours: number; unknownHours: number }
    >();
    for (const row of detail) {
      const key = row.site.id;
      const entry = siteHours.get(key) || {
        site: row.site.name,
        onHours: 0,
        offHours: 0,
        unknownHours: 0,
      };
      entry.onHours += row.onMs / 3600000;
      entry.offHours += row.offMs / 3600000;
      entry.unknownHours += row.unknownMs / 3600000;
      siteHours.set(key, entry);
    }
    const equipmentHours = detail
      .map((row) => ({
        equipmentId: row.id,
        equipment: row.name,
        onHours: row.onMs / 3600000,
      }))
      .sort((a, b) => b.onHours - a.onHours)
      .slice(0, 10);
    const outstandingByOrganization = organizations
      .flatMap((row) =>
        row.outstanding_by_currency.map((balance) => ({
          organizationId: row.id,
          organizationName: row.name,
          currency: balance.currency,
          amount: balance.amount,
        })),
      )
      .filter((row) => Number(row.amount) > 0)
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 10);
    const snapshots = {
      organizations: organizations.length,
      states,
      approachingLimits,
      pendingReviews: currency
        ? billing.reduce((sum, row) => sum + Number(row.pending_count), 0)
        : organizations.reduce(
            (sum, row) => sum + Number(row.pending_payments),
            0,
          ),
      openAlerts:
        Number(alertCounts[0]?.open || 0) +
        Number(alertCounts[0]?.acknowledged || 0),
      criticalAlerts: Number(alertCounts[0]?.critical || 0),
      equipment: {
        total: operational.summary.totalEquipment,
        generators: detail.filter((row) => row.type === EquipmentType.GENERATOR)
          .length,
        ups: detail.filter((row) => row.type === EquipmentType.UPS).length,
        on: operational.summary.knownOn,
        off: operational.summary.knownOff,
        unknown: operational.summary.unknownState,
        online: operational.summary.onlineMonitors,
        offline: operational.summary.offlineMonitors,
        neverConnected: operational.summary.neverConnectedMonitors,
      },
    };
    const periodEquipment = {
      engineRunningEquipmentHours: detail
        .filter(
          (row) =>
            row.monitoringDefinition === MonitoringDefinition.ENGINE_RUNNING,
        )
        .reduce((sum, row) => sum + row.onMs / 3600000, 0),
      outputPoweredEquipmentHours: detail
        .filter(
          (row) =>
            row.monitoringDefinition ===
            MonitoringDefinition.OUTPUT_POWER_PRESENT,
        )
        .reduce((sum, row) => sum + row.onMs / 3600000, 0),
      knownOffEquipmentHours: operational.summary.offEquipmentHours,
      unknownEquipmentHours: operational.summary.unknownEquipmentHours,
      dataCoverage: operational.summary.dataCoverage,
      completedObservedOnSessions: detail.reduce(
        (sum, row) => sum + row.completedOnSessionCount,
        0,
      ),
    };
    const upcomingTimeline = organizations
      .filter(
        (row) =>
          row.administrative_status === 'ACTIVE' &&
          !row.covered_after_end &&
          ['ACTIVE', 'TRIALING', 'GRACE'].includes(row.subscription_status) &&
          row.access_ends_at &&
          new Date(row.access_ends_at).getTime() <= Date.now() + 30 * 86400000,
      )
      .map((row) => ({
        organizationId: row.id,
        organizationName: row.name,
        endsAt: row.access_ends_at,
        kind: row.subscription_status,
      }))
      .sort(
        (a, b) => new Date(a.endsAt!).getTime() - new Date(b.endsAt!).getTime(),
      );
    return {
      generatedAt: new Date(),
      filters: { ...filters, organizationId, siteId, currency, ...period },
      scope: {
        financial: 'organization',
        operational: 'organization and site',
      },
      definitions: {
        snapshot:
          'Current state at generation time. Administratively inactive organizations have no usable access.',
        period:
          'Financial and customer period metrics use [from,to); observed equipment durations are equipment-hours and duration-weighted.',
        collected:
          'Only approved payment allocations count as verified collections. Issued invoices and collected payments in a period may refer to different invoices.',
        trialConversion:
          'Organizations whose trial began in the selected period and have at least one approved paid period, divided by the same trial-start cohort. Incomplete follow-up means the trial has not yet ended.',
        approachingLimits:
          'At least 80% of one positive site, equipment or Controller limit is used.',
      },
      snapshot: snapshots,
      customers: {
        period: lifecyclePeriod[0],
        growth: organizationGrowth,
        byPlan: [...byPlan].map(([plan, count]) => ({ plan, count })),
        byCycle: [...byCycle].map(([cycle, count]) => ({ cycle, count })),
        trialConversion: {
          cohort: cohort.length,
          converted,
          incompleteFollowUp,
        },
        upcoming,
        upcomingTimeline,
        organizations: {
          items: organizations
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice((orgPage - 1) * pageSize, orgPage * pageSize),
          total: organizations.length,
          page: orgPage,
          pageSize,
        },
      },
      billing: {
        money: billing,
        trend: trends,
        methods,
        invoiceStates,
        ageing,
        paymentQueue,
        overdueInvoices,
        outstandingByOrganization,
      },
      operations: {
        summary: operational.summary,
        period: periodEquipment,
        daily: operational.daily,
        siteHours: [...siteHours.values()],
        equipmentHours,
        equipment: {
          items: detail.slice(
            (equipmentPage - 1) * pageSize,
            equipmentPage * pageSize,
          ),
          total: detail.length,
          page: equipmentPage,
          pageSize,
        },
        fuel: {
          purchasedLitres: fuelSummary[0]?.purchased_litres || '0',
          apparentUsageLitres: operational.operational.apparentUsageLitres,
          estimatedLitres: operational.operational.estimatedLitres,
          costs: fuelCosts,
          draftReconciliations: fuelReview[0]?.draft || 0,
          flaggedReconciliations: fuelReview[0]?.flagged || 0,
          trend: operational.costTrend,
        },
        maintenance: {
          due: operational.operational.maintenanceDue,
          overdue: operational.operational.maintenanceOverdue,
          dueSoon: operational.operational.maintenanceDueSoon,
          unableToDetermine: operational.operational.maintenanceUnable,
          upcoming: operational.upcomingMaintenance,
          completed: serviceSummary[0]?.completed || 0,
          costs: serviceCosts,
        },
        alerts: {
          ...alertCounts[0],
          criticalList: criticalAlerts,
          groups: alertGroups,
        },
        recentServices,
        fuelSpendingByLocation,
        activity: operational.activity,
      },
      activity: [...recentActivity, ...organizationCreated]
        .sort(
          (a, b) =>
            new Date(b.occurred_at as Date).getTime() -
            new Date(a.occurred_at as Date).getTime(),
        )
        .slice(0, 20),
    };
  }
}
