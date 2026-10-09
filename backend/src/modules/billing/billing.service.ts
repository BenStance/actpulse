import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  EntitlementService,
  featureKeys,
  PlanSnapshot,
} from './entitlement.service';

type Actor = { sub: string; role: string; organizationId: string | null };
type Row = Record<string, unknown>;
type Proof = {
  originalname: string;
  buffer: Buffer;
  size: number;
  mimetype: string;
};
const cycles: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUALLY: 12,
};
const priceColumn: Record<string, string> = {
  MONTHLY: 'monthly_price',
  QUARTERLY: 'quarterly_price',
  ANNUALLY: 'annual_price',
};
function required(value: unknown, name: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new BadRequestException(
      `${name} is required (maximum ${max} characters)`,
    );
  return value.trim();
}
function amount(value: unknown): string {
  const s =
    typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (!/^\d{1,12}(?:\.\d{1,4})?$/.test(s) || Number(s) <= 0)
    throw new BadRequestException(
      'Use a positive amount with up to four decimal places',
    );
  return s;
}
function snapshot(p: Row): PlanSnapshot {
  return {
    id: String(p.id),
    code: String(p.code),
    name: String(p.name),
    currency: String(p.currency),
    siteLimit: Number(p.site_limit),
    equipmentLimit: Number(p.equipment_limit),
    controllerLimit: Number(p.controller_limit),
    features: p.features as Record<string, boolean>,
  };
}
export function addCalendarMonths(start: Date, count: number): Date {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + count;
  const first = new Date(
    Date.UTC(
      year,
      month,
      1,
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
  const max = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const sourceMax = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(
    start.getUTCDate() === sourceMax ? max : Math.min(start.getUTCDate(), max),
  );
  return first;
}

@Injectable()
export class BillingService {
  private readonly proofDir = resolve(
    process.env.PROOF_STORAGE_DIR || join(process.cwd(), 'storage', 'proofs'),
  );
  constructor(
    private readonly db: DataSource,
    private readonly entitlements: EntitlementService,
  ) {}
  private async rows(
    sql: string,
    args: unknown[] = [],
    manager: EntityManager = this.db.manager,
  ): Promise<Row[]> {
    const result: unknown = await manager.query(sql, args);
    return (
      /^\s*UPDATE/i.test(sql) &&
      Array.isArray(result) &&
      Array.isArray(result[0])
        ? result[0]
        : result
    ) as Row[];
  }
  private org(actor: Actor, target?: string): string {
    if (actor.role === 'Admin') return required(target, 'Organization ID', 50);
    if (!actor.organizationId || (target && target !== actor.organizationId))
      throw new ForbiddenException();
    return actor.organizationId;
  }
  private async audit(
    manager: EntityManager,
    actor: Actor | null,
    org: string | null,
    action: string,
    type: string,
    id: string | null,
    after: Row,
    reason?: string,
  ) {
    await manager.query(
      'INSERT INTO audit_logs(actor_user_id,actor_role,organization_id,action,entity_type,entity_id,after_changes,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        actor?.sub || null,
        actor?.role || null,
        org,
        action,
        type,
        id,
        JSON.stringify(after),
        reason || null,
      ],
    );
  }
  private async activity(
    manager: EntityManager,
    org: string,
    actor: Actor | null,
    kind: string,
    message: string,
    type?: string,
    id?: string,
  ) {
    await manager.query(
      'INSERT INTO customer_activity(organization_id,actor_user_id,kind,message,entity_type,entity_id) VALUES($1,$2,$3,$4,$5,$6)',
      [org, actor?.sub || null, kind, message, type || null, id || null],
    );
  }
  async plans(includeInactive = false) {
    return this.rows(
      `SELECT id,code,name,description,monthly_price,quarterly_price,annual_price,currency,site_limit,equipment_limit,controller_limit,features,is_active,allow_existing_renewals,display_order FROM subscription_plans ${includeInactive ? '' : 'WHERE is_active=true'} ORDER BY display_order,code`,
    );
  }
  async savePlan(actor: Actor, body: Row, id?: string) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const features = body.features as Record<string, unknown>;
    if (
      !features ||
      typeof features !== 'object' ||
      Array.isArray(features) ||
      Object.keys(features).some(
        (key) =>
          !featureKeys.includes(key as (typeof featureKeys)[number]) ||
          typeof features[key] !== 'boolean',
      )
    )
      throw new BadRequestException('Invalid feature configuration');
    const code = required(body.code, 'Plan code', 32).toUpperCase();
    if (!/^[A-Z0-9_]+$/.test(code))
      throw new BadRequestException('Invalid plan code');
    const limit = (key: string) => {
      const n = Number(body[key]);
      if (!Number.isInteger(n) || n < 0 || n > 100000)
        throw new BadRequestException(`Invalid ${key}`);
      return n;
    };
    const currency = required(body.currency, 'Currency', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
      throw new BadRequestException('Invalid currency');
    const values = [
      code,
      required(body.name, 'Plan name', 120),
      typeof body.description === 'string'
        ? body.description.slice(0, 2000)
        : '',
      amount(body.monthlyPrice),
      amount(body.quarterlyPrice),
      amount(body.annualPrice),
      currency,
      limit('siteLimit'),
      limit('equipmentLimit'),
      limit('controllerLimit'),
      JSON.stringify(features),
      body.isActive !== false,
      body.allowExistingRenewals === true,
      limit('displayOrder'),
    ];
    return this.db.transaction(async (manager) => {
      const [row] = id
        ? await this.rows(
            `UPDATE subscription_plans SET code=$2,name=$3,description=$4,monthly_price=$5,quarterly_price=$6,annual_price=$7,currency=$8,site_limit=$9,equipment_limit=$10,controller_limit=$11,features=$12,is_active=$13,allow_existing_renewals=$14,display_order=$15,updated_at=now() WHERE id=$1 RETURNING *`,
            [id, ...values],
            manager,
          )
        : await this.rows(
            `INSERT INTO subscription_plans(code,name,description,monthly_price,quarterly_price,annual_price,currency,site_limit,equipment_limit,controller_limit,features,is_active,allow_existing_renewals,display_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
            values,
            manager,
          );
      if (!row) throw new NotFoundException('Plan not found');
      await this.audit(
        manager,
        actor,
        null,
        id ? 'PLAN_UPDATED' : 'PLAN_CREATED',
        'subscription_plan',
        String(row.id),
        {
          code: row.code,
          monthlyPrice: row.monthly_price,
          quarterlyPrice: row.quarterly_price,
          annualPrice: row.annual_price,
          active: row.is_active,
        },
        required(body.reason, 'Reason', 1000),
      );
      return row;
    });
  }
  async status(actor: Actor, target?: string) {
    const org = this.org(actor, target);
    const entitlement = await this.entitlements.status(org);
    const [invoices, payments, periods, instructions] = await Promise.all([
      this.rows(
        `SELECT i.*,coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0)::text allocated,
        (i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0))::text outstanding
        FROM invoices i WHERE organization_id=$1 ORDER BY issued_at DESC LIMIT 100`,
        [org],
      ),
      this.rows(
        `SELECT id,invoice_id,method,claimed_amount,currency,reference,claimed_paid_at,status,duplicate_warning,verified_amount,review_note,created_at,reviewed_at FROM payment_submissions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`,
        [org],
      ),
      this.rows(
        'SELECT id,kind,plan_snapshot,billing_cycle,starts_at,ends_at,approved_at FROM subscription_periods WHERE organization_id=$1 ORDER BY starts_at DESC LIMIT 100',
        [org],
      ),
      this.rows(
        'SELECT id,method,account_name,provider,account_number,reference_instructions,currency FROM payment_instructions WHERE is_active=true ORDER BY created_at',
        [],
      ),
    ]);
    return { ...entitlement, invoices, payments, periods, instructions };
  }
  async select(actor: Actor, body: Row) {
    const org = this.org(actor, body.organizationId as string | undefined);
    const cycle =
      typeof body.billingCycle === 'string' ? body.billingCycle : '';
    if (!cycles[cycle]) throw new BadRequestException('Invalid billing cycle');
    const planCode = required(body.planCode, 'Plan code', 32);
    const key = required(body.idempotencyKey, 'Idempotency key', 100);
    return this.db.transaction(async (manager) => {
      const [organization] = await this.rows(
        'SELECT id,is_active FROM organizations WHERE id=$1 FOR UPDATE',
        [org],
        manager,
      );
      if (!organization) throw new NotFoundException('Organization not found');
      if (!organization.is_active)
        throw new BadRequestException('Organization is inactive');
      const [existingOrder] = await this.rows(
        'SELECT o.*,i.id invoice_id,i.invoice_number FROM subscription_orders o JOIN invoices i ON i.order_id=o.id WHERE o.organization_id=$1 AND o.idempotency_key=$2',
        [org, key],
        manager,
      );
      if (existingOrder) {
        const [existingPlan] = await this.rows(
          'SELECT code FROM subscription_plans WHERE id=$1',
          [existingOrder.plan_id],
          manager,
        );
        if (
          existingPlan?.code !== planCode ||
          existingOrder.billing_cycle !== cycle
        )
          throw new BadRequestException(
            'Idempotency key belongs to a different selection',
          );
        return {
          order: existingOrder,
          invoiceId: existingOrder.invoice_id,
          trialStarted: false,
        };
      }
      const [plan] = await this.rows(
        'SELECT * FROM subscription_plans WHERE code=$1',
        [planCode],
        manager,
      );
      if (!plan) throw new NotFoundException('Plan not found');
      const [sub] = await this.rows(
        'SELECT * FROM organization_subscriptions WHERE organization_id=$1 FOR UPDATE',
        [org],
        manager,
      );
      if (
        !plan.is_active &&
        !(sub && sub.plan_id === plan.id && plan.allow_existing_renewals)
      )
        throw new BadRequestException('Plan is unavailable for new purchases');
      const snap = snapshot(plan);
      if (sub && sub.state === 'SUSPENDED')
        throw new BadRequestException('Subscription is suspended');
      const usage = await this.entitlements.status(org, manager);
      const excess = {
        sites: Math.max(0, usage.usage.sites - snap.siteLimit),
        equipment: Math.max(0, usage.usage.equipment - snap.equipmentLimit),
        controllers: Math.max(
          0,
          usage.usage.controllers - snap.controllerLimit,
        ),
      };
      if (Object.values(excess).some(Boolean))
        throw new BadRequestException({
          code: 'PLAN_LIMIT_REACHED',
          message: 'Resolve excess resources before selecting this plan',
          excess,
        });
      const [pending] = await this.rows(
        `SELECT i.id FROM invoices i JOIN subscription_orders o ON o.id=i.order_id WHERE i.organization_id=$1 AND i.status='PARTIALLY_PAID' LIMIT 1`,
        [org],
        manager,
      );
      if (pending && sub && sub.state === 'TRIALING' && sub.plan_id !== plan.id)
        throw new BadRequestException(
          'Resolve partial payment before changing the trial plan',
        );
      let trialStarted = false;
      if (!sub) {
        const now = new Date();
        const end = new Date(now.getTime() + 14 * 86400000);
        await manager.query(
          `INSERT INTO organization_subscriptions(organization_id,plan_id,plan_snapshot,billing_cycle,state,trial_started_at,trial_ends_at) VALUES($1,$2,$3,$4,'TRIALING',$5,$6)`,
          [org, plan.id, JSON.stringify(snap), cycle, now, end],
        );
        await manager.query(
          `INSERT INTO subscription_periods(organization_id,plan_id,plan_snapshot,billing_cycle,kind,starts_at,ends_at) VALUES($1,$2,$3,$4,'TRIAL',$5,$6)`,
          [org, plan.id, JSON.stringify(snap), cycle, now, end],
        );
        await this.audit(
          manager,
          actor,
          org,
          'TRIAL_STARTED',
          'organization_subscription',
          org,
          { planCode, trialEndsAt: end.toISOString() },
        );
        await this.activity(
          manager,
          org,
          actor,
          'TRIAL_STARTED',
          `14-day ${snap.name} trial started`,
          'organization_subscription',
          org,
        );
        trialStarted = true;
      } else if (
        sub.state === 'TRIALING' &&
        Date.now() < new Date(sub.trial_ends_at as Date).getTime()
      ) {
        if (sub.plan_id !== plan.id) {
          const [paid] = await this.rows(
            "SELECT id FROM subscription_periods WHERE organization_id=$1 AND kind='PAID' LIMIT 1",
            [org],
            manager,
          );
          if (paid)
            throw new BadRequestException('A paid period is already scheduled');
          await manager.query(
            `UPDATE organization_subscriptions SET plan_id=$2,plan_snapshot=$3,billing_cycle=$4,updated_at=now() WHERE organization_id=$1`,
            [org, plan.id, JSON.stringify(snap), cycle],
          );
          await manager.query(
            `UPDATE subscription_periods SET plan_id=$2,plan_snapshot=$3,billing_cycle=$4 WHERE organization_id=$1 AND kind='TRIAL'`,
            [org, plan.id, JSON.stringify(snap), cycle],
          );
          await manager.query(
            `UPDATE invoices SET status='VOID' WHERE organization_id=$1 AND status='OPEN'`,
            [org],
          );
          await manager.query(
            `UPDATE subscription_orders SET status='VOID' WHERE organization_id=$1 AND status='OPEN'`,
            [org],
          );
          await this.audit(
            manager,
            actor,
            org,
            'TRIAL_PLAN_CHANGED',
            'organization_subscription',
            org,
            { planCode },
          );
        }
      }
      const [openOrder] = await this.rows(
        `SELECT o.*,i.id invoice_id,i.invoice_number FROM subscription_orders o JOIN invoices i ON i.order_id=o.id
         WHERE o.organization_id=$1 AND o.plan_id=$2 AND o.billing_cycle=$3 AND o.status='OPEN' AND i.status IN ('OPEN','PARTIALLY_PAID')
         ORDER BY o.created_at DESC LIMIT 1`,
        [org, plan.id, cycle],
        manager,
      );
      if (openOrder)
        return {
          order: openOrder,
          invoiceId: openOrder.invoice_id,
          invoiceNumber: openOrder.invoice_number,
          trialStarted,
        };
      const price = String(plan[priceColumn[cycle]]);
      const instructions = await this.rows(
        'SELECT method,account_name,provider,account_number,reference_instructions,currency FROM payment_instructions WHERE is_active=true AND currency=$1 ORDER BY created_at',
        [plan.currency],
        manager,
      );
      const [order] = await this.rows(
        `INSERT INTO subscription_orders(organization_id,plan_id,plan_snapshot,billing_cycle,amount,currency,idempotency_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          org,
          plan.id,
          JSON.stringify(snap),
          cycle,
          price,
          plan.currency,
          key,
          actor.sub,
        ],
        manager,
      );
      const [number] = await this.rows(
        "SELECT nextval('billing_invoice_number_seq')::bigint number",
        [],
        manager,
      );
      const invoiceNumber = `AP-${new Date().getUTCFullYear()}-${String(number.number).padStart(7, '0')}`;
      const [invoice] = await this.rows(
        `INSERT INTO invoices(invoice_number,organization_id,order_id,plan_snapshot,billing_cycle,subtotal,total,currency,instruction_snapshot,due_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$6,$7,$8,now()+interval '14 days',$9) RETURNING *`,
        [
          invoiceNumber,
          org,
          order.id,
          JSON.stringify(snap),
          cycle,
          price,
          plan.currency,
          JSON.stringify(instructions),
          actor.sub,
        ],
        manager,
      );
      await manager.query(
        'INSERT INTO invoice_items(invoice_id,description,quantity,unit_amount,total) VALUES($1,$2,1,$3,$3)',
        [invoice.id, `${snap.name} ${cycle.toLowerCase()} subscription`, price],
      );
      await this.audit(
        manager,
        actor,
        org,
        'INVOICE_ISSUED',
        'invoice',
        String(invoice.id),
        { number: invoiceNumber, total: price, currency: plan.currency },
      );
      await this.activity(
        manager,
        org,
        actor,
        'INVOICE_ISSUED',
        `Invoice ${invoiceNumber} issued`,
        'invoice',
        String(invoice.id),
      );
      return { order, invoiceId: invoice.id, invoiceNumber, trialStarted };
    });
  }
  async invoice(
    actor: Actor,
    id: string,
  ): Promise<Row & { items: Row[]; overdue: boolean }> {
    const [row] = await this.rows(
      `SELECT i.*,o.plan_id,o.status order_status,org.name organization_name,org.contact_email,
      coalesce((SELECT sum(amount) FROM payment_allocations WHERE invoice_id=i.id),0)::text allocated,
      (i.total-coalesce((SELECT sum(amount) FROM payment_allocations WHERE invoice_id=i.id),0))::text outstanding
      FROM invoices i JOIN subscription_orders o ON o.id=i.order_id JOIN organizations org ON org.id=i.organization_id WHERE i.id=$1`,
      [id],
    );
    if (!row) throw new NotFoundException('Invoice not found');
    this.org(actor, String(row.organization_id));
    const items = await this.rows(
      'SELECT description,quantity,unit_amount,total FROM invoice_items WHERE invoice_id=$1',
      [id],
    );
    return {
      ...row,
      items,
      overdue:
        row.status !== 'PAID' &&
        row.status !== 'VOID' &&
        new Date(row.due_at as Date).getTime() < Date.now(),
    };
  }
  async history(actor: Actor, kind: string, query: Row) {
    const org = this.org(actor, query.organizationId as string | undefined);
    const sources: Record<
      string,
      {
        table: string;
        date: string;
        state: string;
        search: string;
        columns: string;
      }
    > = {
      invoices: {
        table: 'invoices',
        date: 'issued_at',
        state: 'status',
        search: 'invoice_number',
        columns: `id,invoice_number,issued_at,due_at,status,total,currency,
          (total-coalesce((SELECT sum(amount) FROM payment_allocations WHERE invoice_id=invoices.id),0))::text outstanding`,
      },
      payments: {
        table: 'payment_submissions',
        date: 'created_at',
        state: 'status',
        search: 'reference',
        columns:
          'id,invoice_id,method,claimed_amount,currency,reference,claimed_paid_at,status,duplicate_warning,verified_amount,review_note,created_at,reviewed_at',
      },
      periods: {
        table: 'subscription_periods',
        date: 'starts_at',
        state: 'kind',
        search: "plan_snapshot->>'name'",
        columns:
          'id,kind,plan_snapshot,billing_cycle,starts_at,ends_at,approved_at',
      },
    };
    const source = sources[kind];
    if (!source) throw new BadRequestException('Invalid billing history type');
    const requestedPage = Number(query.page);
    const requestedSize = Number(query.pageSize);
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
    const pageSize =
      Number.isSafeInteger(requestedSize) && requestedSize > 0
        ? Math.min(100, requestedSize)
        : 20;
    const status = query.status ? required(query.status, 'Status', 30) : null;
    const search = query.search ? required(query.search, 'Search', 100) : null;
    const from = query.from
      ? new Date(required(query.from, 'From date', 50))
      : null;
    const to = query.to ? new Date(required(query.to, 'To date', 50)) : null;
    if (
      (from && !Number.isFinite(from.getTime())) ||
      (to && !Number.isFinite(to.getTime())) ||
      (from && to && from >= to)
    )
      throw new BadRequestException('Invalid history date range');
    const where = `organization_id=$1 AND ($2::text IS NULL OR ${source.state}=$2) AND
      ($3::timestamptz IS NULL OR ${source.date}>=$3) AND ($4::timestamptz IS NULL OR ${source.date}<$4) AND
      ($5::text IS NULL OR ${source.search} ILIKE '%' || $5 || '%')`;
    const args = [org, status, from, to, search];
    const [count] = await this.rows(
      `SELECT count(*)::int total FROM ${source.table} WHERE ${where}`,
      args,
    );
    const items = await this.rows(
      `SELECT ${source.columns} FROM ${source.table} WHERE ${where} ORDER BY ${source.date} DESC,id DESC LIMIT $6 OFFSET $7`,
      [...args, pageSize, (page - 1) * pageSize],
    );
    return { items, total: count?.total || 0, page, pageSize };
  }
  async instructions(actor: Actor, all = false) {
    if (all && actor.role !== 'Admin') throw new ForbiddenException();
    return this.rows(
      `SELECT * FROM payment_instructions ${all ? '' : 'WHERE is_active=true'} ORDER BY created_at DESC`,
    );
  }
  async saveInstruction(actor: Actor, body: Row, id?: string) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const method = String(body.method);
    if (!['BANK_TRANSFER', 'MOBILE_MONEY'].includes(method))
      throw new BadRequestException('Invalid method');
    const currency = required(body.currency, 'Currency', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency))
      throw new BadRequestException('Invalid currency');
    const values = [
      method,
      required(body.accountName, 'Account name', 160),
      required(body.provider, 'Provider', 160),
      required(body.accountNumber, 'Payment number', 100),
      typeof body.referenceInstructions === 'string'
        ? body.referenceInstructions.slice(0, 2000)
        : null,
      currency,
      body.isActive !== false,
    ];
    return this.db.transaction(async (manager) => {
      const [row] = id
        ? await this.rows(
            `UPDATE payment_instructions SET method=$2,account_name=$3,provider=$4,account_number=$5,reference_instructions=$6,currency=$7,is_active=$8,updated_at=now() WHERE id=$1 RETURNING *`,
            [id, ...values],
            manager,
          )
        : await this.rows(
            `INSERT INTO payment_instructions(method,account_name,provider,account_number,reference_instructions,currency,is_active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            values,
            manager,
          );
      if (!row) throw new NotFoundException('Instruction not found');
      await this.audit(
        manager,
        actor,
        null,
        'PAYMENT_INSTRUCTION_CHANGED',
        'payment_instruction',
        String(row.id),
        { method, currency, active: row.is_active },
        required(body.reason, 'Reason', 1000),
      );
      return row;
    });
  }
  async submit(actor: Actor, invoiceId: string, body: Row, file?: Proof) {
    if (!file)
      throw new BadRequestException('PDF, JPEG or PNG proof is required');
    const max = Number(process.env.PAYMENT_PROOF_MAX_BYTES || 5242880);
    if (file.size < 1 || file.size > max)
      throw new BadRequestException('Proof exceeds the configured size limit');
    const b = file.buffer;
    const pdf =
      b.subarray(0, 5).toString() === '%PDF-' &&
      b.includes(Buffer.from('%%EOF'));
    const jpg =
      b[0] === 0xff && b[1] === 0xd8 && b.at(-2) === 0xff && b.at(-1) === 0xd9;
    const png = b
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const ext = file.originalname.toLowerCase().split('.').pop();
    const mime = pdf
      ? 'application/pdf'
      : jpg
        ? 'image/jpeg'
        : png
          ? 'image/png'
          : null;
    if (
      !mime ||
      !(
        (pdf && ext === 'pdf') ||
        (jpg && ['jpg', 'jpeg'].includes(ext || '')) ||
        (png && ext === 'png')
      ) ||
      (file.mimetype && file.mimetype !== mime)
    )
      throw new BadRequestException(
        'Proof content, extension and MIME type must match PDF, JPEG or PNG',
      );
    const inv = await this.invoice(actor, invoiceId);
    if (inv.status === 'VOID' || inv.status === 'PAID')
      throw new BadRequestException('Invoice is not payable');
    const claimed = amount(body.claimedAmount);
    if (String(body.currency) !== inv.currency)
      throw new BadRequestException('Payment currency must match the invoice');
    const method = String(body.method);
    if (!['BANK_TRANSFER', 'MOBILE_MONEY'].includes(method))
      throw new BadRequestException('Invalid payment method');
    const paid = new Date(
      typeof body.claimedPaidAt === 'string' ? body.claimedPaidAt : NaN,
    );
    if (
      !Number.isFinite(paid.getTime()) ||
      paid.getTime() > Date.now() + 300000
    )
      throw new BadRequestException('Invalid payment date');
    const reference = required(body.reference, 'Transaction reference', 160);
    const id = randomUUID();
    const digest = createHash('sha256').update(b).digest('hex');
    await mkdir(this.proofDir, { recursive: true, mode: 0o700 });
    await writeFile(join(this.proofDir, id), b, { mode: 0o600, flag: 'wx' });
    try {
      return await this.db.transaction(async (manager) => {
        const [duplicate] = await this.rows(
          'SELECT id FROM payment_submissions WHERE organization_id=$1 AND (reference=$2 OR proof_sha256=$3) LIMIT 1',
          [inv.organization_id, reference, digest],
          manager,
        );
        const [row] = await this.rows(
          `INSERT INTO payment_submissions(organization_id,invoice_id,submitted_by,method,claimed_amount,currency,reference,claimed_paid_at,proof_storage_id,proof_original_name,proof_mime,proof_sha256,proof_size,duplicate_warning) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,status,duplicate_warning,created_at`,
          [
            inv.organization_id,
            invoiceId,
            actor.sub,
            method,
            claimed,
            inv.currency,
            reference,
            paid,
            id,
            file.originalname.slice(0, 255),
            mime,
            digest,
            file.size,
            !!duplicate,
          ],
          manager,
        );
        await this.audit(
          manager,
          actor,
          String(inv.organization_id),
          'PAYMENT_SUBMITTED',
          'payment_submission',
          String(row.id),
          {
            invoiceId,
            claimedAmount: claimed,
            currency: inv.currency,
            duplicateWarning: !!duplicate,
          },
        );
        await this.activity(
          manager,
          String(inv.organization_id),
          actor,
          'PAYMENT_SUBMITTED',
          'Payment proof submitted for review',
          'payment_submission',
          String(row.id),
        );
        return row;
      });
    } catch (error) {
      await unlink(join(this.proofDir, id)).catch(() => undefined);
      throw error;
    }
  }
  async proof(actor: Actor, id: string) {
    const [row] = await this.rows(
      'SELECT organization_id,proof_storage_id,proof_mime FROM payment_submissions WHERE id=$1',
      [id],
    );
    if (!row) throw new NotFoundException('Proof not found');
    this.org(actor, String(row.organization_id));
    try {
      return {
        data: await readFile(join(this.proofDir, String(row.proof_storage_id))),
        mime: String(row.proof_mime),
      };
    } catch {
      throw new NotFoundException('Proof unavailable');
    }
  }
  async reviewQueue(actor: Actor, query: Row) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const page = Math.max(1, Number(query.page) || 1),
      size = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const status =
      typeof query.status === 'string' ? query.status : 'PENDING_REVIEW';
    if (!['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ALL'].includes(status))
      throw new BadRequestException('Invalid status');
    return this.rows(
      `SELECT p.id,p.organization_id,o.name organization_name,p.invoice_id,i.invoice_number,p.method,p.claimed_amount,p.currency,p.reference,p.claimed_paid_at,p.status,p.duplicate_warning,p.verified_amount,p.review_note,p.created_at,p.reviewed_at FROM payment_submissions p JOIN organizations o ON o.id=p.organization_id JOIN invoices i ON i.id=p.invoice_id WHERE ($1='ALL' OR p.status=$1) AND ($2::uuid IS NULL OR p.organization_id=$2) ORDER BY p.created_at DESC LIMIT $3 OFFSET $4`,
      [status, query.organizationId || null, size, (page - 1) * size],
    );
  }
  async review(actor: Actor, id: string, body: Row) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const decision = String(body.decision);
    if (!['APPROVE', 'REJECT'].includes(decision))
      throw new BadRequestException('Invalid decision');
    const reason = required(body.note, 'Review note', 1000);
    return this.db.transaction(async (manager) => {
      const [payment] = await this.rows(
        'SELECT * FROM payment_submissions WHERE id=$1 FOR UPDATE',
        [id],
        manager,
      );
      if (!payment) throw new NotFoundException('Submission not found');
      if (payment.status !== 'PENDING_REVIEW')
        return { status: payment.status, alreadyReviewed: true };
      const [invoice] = await this.rows(
        'SELECT * FROM invoices WHERE id=$1 FOR UPDATE',
        [payment.invoice_id],
        manager,
      );
      if (!invoice || invoice.status === 'VOID')
        throw new BadRequestException('Invoice is void');
      if (decision === 'REJECT') {
        await manager.query(
          "UPDATE payment_submissions SET status='REJECTED',reviewed_by=$2,reviewed_at=now(),review_note=$3 WHERE id=$1",
          [id, actor.sub, reason],
        );
        await this.audit(
          manager,
          actor,
          String(payment.organization_id),
          'PAYMENT_REJECTED',
          'payment_submission',
          id,
          { invoiceId: payment.invoice_id },
          reason,
        );
        await this.activity(
          manager,
          String(payment.organization_id),
          actor,
          'PAYMENT_REJECTED',
          'Payment proof rejected; resubmission is available',
          'payment_submission',
          id,
        );
        return { status: 'REJECTED' };
      }
      const verified = amount(body.verifiedAmount);
      const [balance] = await this.rows(
        'SELECT ($2::numeric > i.total-coalesce(sum(a.amount),0)) exceeds FROM invoices i LEFT JOIN payment_allocations a ON a.invoice_id=i.id WHERE i.id=$1 GROUP BY i.id',
        [invoice.id, verified],
        manager,
      );
      if (!balance || balance.exceeds === true)
        throw new BadRequestException(
          'Verified amount exceeds outstanding balance',
        );
      await manager.query(
        'INSERT INTO payment_allocations(submission_id,invoice_id,amount) VALUES($1,$2,$3)',
        [id, invoice.id, verified],
      );
      await manager.query(
        "UPDATE payment_submissions SET status='APPROVED',verified_amount=$2,reviewed_by=$3,reviewed_at=now(),review_note=$4 WHERE id=$1",
        [id, verified, actor.sub, reason],
      );
      const [remaining] = await this.rows(
        'SELECT (i.total-coalesce(sum(a.amount),0)=0) fully_paid FROM invoices i LEFT JOIN payment_allocations a ON a.invoice_id=i.id WHERE i.id=$1 GROUP BY i.id',
        [invoice.id],
        manager,
      );
      const fullyPaid = remaining.fully_paid === true;
      await manager.query('UPDATE invoices SET status=$2 WHERE id=$1', [
        invoice.id,
        fullyPaid ? 'PAID' : 'PARTIALLY_PAID',
      ]);
      await this.audit(
        manager,
        actor,
        String(payment.organization_id),
        'PAYMENT_APPROVED',
        'payment_submission',
        id,
        {
          invoiceId: invoice.id,
          verifiedAmount: verified,
          currency: invoice.currency,
        },
        reason,
      );
      await this.activity(
        manager,
        String(payment.organization_id),
        actor,
        'PAYMENT_APPROVED',
        fullyPaid
          ? 'Payment approved; subscription period created'
          : 'Partial payment approved; invoice still has a balance',
        'payment_submission',
        id,
      );
      if (fullyPaid) await this.activate(manager, actor, invoice);
      return {
        status: 'APPROVED',
        verifiedAmount: verified,
        invoicePaid: fullyPaid,
      };
    });
  }
  private async activate(manager: EntityManager, actor: Actor, invoice: Row) {
    const [order] = await this.rows(
      'SELECT * FROM subscription_orders WHERE id=$1 FOR UPDATE',
      [invoice.order_id],
      manager,
    );
    if (order.status === 'PAID') return;
    const org = String(invoice.organization_id);
    const now = new Date();
    const [sub] = await this.rows(
      'SELECT * FROM organization_subscriptions WHERE organization_id=$1 FOR UPDATE',
      [org],
      manager,
    );
    if (!sub) throw new BadRequestException('Subscription not found');
    const [latest] = await this.rows(
      "SELECT * FROM subscription_periods WHERE organization_id=$1 AND kind='PAID' ORDER BY ends_at DESC LIMIT 1 FOR UPDATE",
      [org],
      manager,
    );
    const trialEnd = new Date(sub.trial_ends_at as Date);
    let start = now;
    if (latest && new Date(latest.ends_at as Date) > start)
      start = new Date(latest.ends_at as Date);
    else if (trialEnd > start) start = trialEnd;
    const [other] = await this.rows(
      "SELECT id FROM subscription_periods WHERE organization_id=$1 AND kind='PAID' AND starts_at>now() AND plan_id<>$2 LIMIT 1",
      [org, order.plan_id],
      manager,
    );
    if (other)
      throw new BadRequestException('Conflicting scheduled plan change');
    const end = addCalendarMonths(start, cycles[String(order.billing_cycle)]);
    await manager.query(
      `INSERT INTO subscription_periods(organization_id,order_id,plan_id,plan_snapshot,billing_cycle,kind,starts_at,ends_at,approved_at) VALUES($1,$2,$3,$4,$5,'PAID',$6,$7,$8)`,
      [
        org,
        order.id,
        order.plan_id,
        JSON.stringify(order.plan_snapshot),
        order.billing_cycle,
        start,
        end,
        now,
      ],
    );
    await manager.query(
      "UPDATE subscription_orders SET status='PAID' WHERE id=$1",
      [order.id],
    );
    await manager.query(
      "UPDATE organization_subscriptions SET plan_id=$2,plan_snapshot=$3,billing_cycle=$4,paid_start_at=$5,paid_end_at=$6,grace_ends_at=NULL,state=CASE WHEN state='SUSPENDED' THEN state ELSE 'ACTIVE' END,updated_at=now() WHERE organization_id=$1",
      [
        org,
        order.plan_id,
        JSON.stringify(order.plan_snapshot),
        order.billing_cycle,
        start,
        end,
      ],
    );
    await this.audit(
      manager,
      actor,
      org,
      'SUBSCRIPTION_ACTIVATED',
      'subscription_period',
      String(order.id),
      {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        planCode: (order.plan_snapshot as PlanSnapshot).code,
      },
    );
    await this.activity(
      manager,
      org,
      actor,
      'SUBSCRIPTION_ACTIVATED',
      `Paid access scheduled from ${start.toISOString()} to ${end.toISOString()}`,
      'subscription_order',
      String(order.id),
    );
  }
  async suspend(actor: Actor, org: string, suspend: boolean, reason: unknown) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const why = required(reason, 'Reason', 1000);
    return this.db.transaction(async (manager) => {
      const [row] = await this.rows(
        'SELECT * FROM organization_subscriptions WHERE organization_id=$1 FOR UPDATE',
        [org],
        manager,
      );
      if (!row) throw new NotFoundException('Subscription not found');
      await manager.query(
        'UPDATE organization_subscriptions SET state=$2,suspension_reason=$3,updated_at=now() WHERE organization_id=$1',
        [org, suspend ? 'SUSPENDED' : 'EXPIRED', suspend ? why : null],
      );
      await this.audit(
        manager,
        actor,
        org,
        suspend ? 'SUBSCRIPTION_SUSPENDED' : 'SUBSCRIPTION_RESTORED',
        'organization_subscription',
        org,
        { suspended: suspend },
        why,
      );
      await this.activity(
        manager,
        org,
        actor,
        suspend ? 'SUBSCRIPTION_SUSPENDED' : 'SUBSCRIPTION_RESTORED',
        suspend
          ? 'Subscription access suspended'
          : 'Subscription access restored subject to original dates',
        'organization_subscription',
        org,
      );
      return this.entitlements.status(org, manager);
    });
  }
  async adminStats(actor: Actor, from?: string, to?: string) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const start = from ? new Date(from) : new Date(Date.now() - 30 * 86400000),
      end = to ? new Date(to) : new Date();
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start ||
      end.getTime() - start.getTime() > 366 * 86400000
    )
      throw new BadRequestException('Invalid statistics period');
    const [organizations, states, money, trend, plans, conversions, upcoming] =
      await Promise.all([
        this.rows('SELECT count(*)::int total FROM organizations'),
        this
          .rows(`SELECT count(*) FILTER (WHERE s.state='SUSPENDED')::int suspended,
        count(*) FILTER (WHERE s.state<>'SUSPENDED' AND s.trial_started_at<=now() AND s.trial_ends_at>now() AND NOT EXISTS(SELECT 1 FROM subscription_periods p WHERE p.organization_id=s.organization_id AND p.kind='PAID' AND p.starts_at<=now() AND p.ends_at>now()))::int trialing,
        count(*) FILTER (WHERE s.state<>'SUSPENDED' AND EXISTS(SELECT 1 FROM subscription_periods p WHERE p.organization_id=s.organization_id AND p.kind='PAID' AND p.starts_at<=now() AND p.ends_at>now()))::int active,
        count(*) FILTER (WHERE s.state<>'SUSPENDED' AND s.paid_end_at<=now() AND s.grace_ends_at>now() AND NOT EXISTS(SELECT 1 FROM subscription_periods p WHERE p.organization_id=s.organization_id AND p.kind='PAID' AND p.starts_at<=now() AND p.ends_at>now()))::int grace,
        count(*) FILTER (WHERE s.state<>'SUSPENDED' AND s.trial_ends_at<=now() AND (s.grace_ends_at IS NULL OR s.grace_ends_at<=now()) AND NOT EXISTS(SELECT 1 FROM subscription_periods p WHERE p.organization_id=s.organization_id AND p.kind='PAID' AND p.starts_at<=now() AND p.ends_at>now()))::int expired,
        count(*) FILTER (WHERE s.trial_ends_at>now() AND s.trial_ends_at<=now()+interval '7 days')::int trials_expiring_soon FROM organization_subscriptions s`),
        this.rows(
          `SELECT currency,
        (SELECT coalesce(sum(total),0)::text FROM invoices i WHERE i.currency=c.currency AND i.status<>'VOID' AND i.issued_at>=$1 AND i.issued_at<$2) invoiced,
        (SELECT coalesce(sum(a.amount),0)::text FROM payment_allocations a JOIN invoices i ON i.id=a.invoice_id WHERE i.currency=c.currency AND a.allocated_at>=$1 AND a.allocated_at<$2) collected,
        (SELECT coalesce(sum(i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0)),0)::text FROM invoices i WHERE i.currency=c.currency AND i.status NOT IN ('PAID','VOID')) outstanding,
        (SELECT coalesce(sum(i.total-coalesce((SELECT sum(a.amount) FROM payment_allocations a WHERE a.invoice_id=i.id),0)),0)::text FROM invoices i WHERE i.currency=c.currency AND i.status NOT IN ('PAID','VOID') AND i.due_at<now()) overdue
        FROM (SELECT DISTINCT currency FROM invoices) c`,
          [start, end],
        ),
        this.rows(
          `SELECT date_trunc('day',a.allocated_at)::date AS "day",i.currency,sum(a.amount)::text collected FROM payment_allocations a JOIN invoices i ON i.id=a.invoice_id WHERE a.allocated_at>=$1 AND a.allocated_at<$2 GROUP BY 1,i.currency ORDER BY 1`,
          [start, end],
        ),
        this.rows(
          `SELECT (s.plan_snapshot->>'code') code,count(*)::int organizations FROM organization_subscriptions s GROUP BY code ORDER BY code`,
        ),
        this.rows(
          `SELECT count(*)::int cohort,count(*) FILTER (WHERE EXISTS(SELECT 1 FROM subscription_periods p WHERE p.organization_id=s.organization_id AND p.kind='PAID'))::int converted FROM organization_subscriptions s WHERE s.trial_started_at>=$1 AND s.trial_started_at<$2`,
          [start, end],
        ),
        this.rows(`SELECT "day",kind,count(*)::int organizations FROM (
          SELECT date_trunc('day',s.trial_ends_at)::date AS "day",'TRIAL' kind FROM organization_subscriptions s
          WHERE s.trial_ends_at>=now() AND s.trial_ends_at<now()+interval '30 days'
            AND NOT EXISTS(SELECT 1 FROM subscription_periods p WHERE p.organization_id=s.organization_id
              AND p.kind='PAID' AND p.starts_at<=s.trial_ends_at AND p.ends_at>s.trial_ends_at)
          UNION ALL
          SELECT date_trunc('day',p.ends_at)::date AS "day",'PAID' kind FROM subscription_periods p
          WHERE p.kind='PAID' AND p.ends_at>=now() AND p.ends_at<now()+interval '30 days'
            AND NOT EXISTS(SELECT 1 FROM subscription_periods next_period WHERE next_period.organization_id=p.organization_id
              AND next_period.kind='PAID' AND next_period.id<>p.id AND next_period.starts_at<=p.ends_at AND next_period.ends_at>p.ends_at)
        ) dates GROUP BY "day",kind ORDER BY "day",kind`),
      ]);
    const [pending] = await this.rows(
      "SELECT count(*)::int count FROM payment_submissions WHERE status='PENDING_REVIEW'",
    );
    return {
      period: { from: start, to: end },
      organizations: organizations[0]?.total || 0,
      states: states[0],
      pendingReviews: pending?.count || 0,
      money,
      verifiedByDay: trend,
      byPlan: plans,
      upcomingExpiries: upcoming,
      trialConversion: {
        cohort: conversions[0]?.cohort || 0,
        converted: conversions[0]?.converted || 0,
      },
    };
  }
  async auditList(actor: Actor, q: Row) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const page = Math.max(1, Number(q.page) || 1),
      size = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    const filterArgs = [
      q.organizationId || null,
      q.action || null,
      q.actorId || null,
      q.entityType || null,
      q.from || null,
      q.to || null,
    ];
    const where = `WHERE ($1::uuid IS NULL OR a.organization_id=$1) AND ($2::text IS NULL OR a.action=$2) AND ($3::uuid IS NULL OR a.actor_user_id=$3) AND ($4::text IS NULL OR a.entity_type=$4) AND ($5::timestamptz IS NULL OR a.occurred_at>=$5) AND ($6::timestamptz IS NULL OR a.occurred_at<$6)`;
    const [rows, count] = await Promise.all([
      this.rows(
        `SELECT a.id,a.occurred_at,a.actor_user_id,a.actor_role,u.name actor_name,a.organization_id,o.name organization_name,a.action,a.entity_type,a.entity_id,a.outcome,a.before_changes,a.after_changes,a.reason,a.correlation_id FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN organizations o ON o.id=a.organization_id ${where} ORDER BY a.occurred_at DESC LIMIT $7 OFFSET $8`,
        [...filterArgs, size, (page - 1) * size],
      ),
      this.rows(
        `SELECT count(*)::int total FROM audit_logs a ${where}`,
        filterArgs,
      ),
    ]);
    return {
      items: rows,
      total: Number(count[0]?.total || 0),
      page,
      pageSize: size,
    };
  }
  async activityList(actor: Actor, q: Row) {
    const org = this.org(actor, q.organizationId as string | undefined);
    const page = Math.max(1, Number(q.page) || 1),
      size = Math.min(100, Math.max(1, Number(q.pageSize) || 25));
    return {
      items: await this.rows(
        `SELECT * FROM (
          SELECT id,occurred_at,kind,message,entity_type,entity_id,actor_user_id
          FROM customer_activity WHERE organization_id=$1
          UNION ALL
          SELECT a.id,a.occurred_at,'OPERATIONAL'::text,
            initcap(replace(a.entity_type,'_',' ')) || ' ' || lower(replace(a.action,'_',' ')),
            a.entity_type,a.entity_id,a.actor_id
          FROM operational_audit a
          LEFT JOIN fuel_tanks t ON t.id=coalesce(nullif(a.after_data->>'tank_id',''),nullif(a.before_data->>'tank_id',''))::uuid
          JOIN equipment e ON e.id=coalesce(t.generator_id,
            nullif(coalesce(a.after_data->>'equipment_id',a.before_data->>'equipment_id',a.after_data->>'generator_id'),'')::uuid)
          WHERE e.organization_id=$1 AND ($4='Admin' OR EXISTS
            (SELECT 1 FROM user_equipment ue WHERE ue.equipment_id=e.id AND ue.user_id=$5))
        ) activity ORDER BY occurred_at DESC LIMIT $2 OFFSET $3`,
        [org, size, (page - 1) * size, actor.role, actor.sub],
      ),
      page,
      pageSize: size,
    };
  }
}
