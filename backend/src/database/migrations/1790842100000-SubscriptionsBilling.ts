import { MigrationInterface, QueryRunner } from 'typeorm';

export class SubscriptionsBilling1790842100000 implements MigrationInterface {
  name = 'SubscriptionsBilling1790842100000';
  public async up(r: QueryRunner): Promise<void> {
    await r.query(`CREATE TABLE subscription_plans (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), code varchar(32) NOT NULL UNIQUE,
      name varchar(120) NOT NULL, description text,
      monthly_price numeric(18,4) NOT NULL CHECK(monthly_price>=0), quarterly_price numeric(18,4) NOT NULL CHECK(quarterly_price>=0), annual_price numeric(18,4) NOT NULL CHECK(annual_price>=0),
      currency char(3) NOT NULL, site_limit integer NOT NULL CHECK(site_limit>=0), equipment_limit integer NOT NULL CHECK(equipment_limit>=0), controller_limit integer NOT NULL CHECK(controller_limit>=0),
      features jsonb NOT NULL, is_active boolean NOT NULL DEFAULT true, allow_existing_renewals boolean NOT NULL DEFAULT false,
      display_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await r.query(`CREATE TABLE organization_subscriptions (
      organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT,
      plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
      plan_snapshot jsonb NOT NULL, billing_cycle varchar(12) NOT NULL CHECK(billing_cycle IN ('MONTHLY','QUARTERLY','ANNUALLY')),
      state varchar(12) NOT NULL CHECK(state IN ('TRIALING','ACTIVE','EXPIRED','SUSPENDED')),
      trial_started_at timestamptz NOT NULL, trial_ends_at timestamptz NOT NULL,
      paid_start_at timestamptz, paid_end_at timestamptz,
      suspension_reason text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await r.query(`CREATE TABLE subscription_periods (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      order_id uuid, plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT, plan_snapshot jsonb NOT NULL,
      billing_cycle varchar(12) NOT NULL, kind varchar(8) NOT NULL CHECK(kind IN ('TRIAL','PAID')),
      starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at), approved_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await r.query(
      `CREATE INDEX subscription_periods_org_dates ON subscription_periods(organization_id,starts_at,ends_at)`,
    );
    await r.query(`CREATE TABLE payment_instructions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), method varchar(16) NOT NULL CHECK(method IN ('BANK_TRANSFER','MOBILE_MONEY')),
      account_name varchar(160) NOT NULL, provider varchar(160) NOT NULL, account_number varchar(100) NOT NULL,
      reference_instructions text, currency char(3) NOT NULL, is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await r.query(`CREATE TABLE subscription_orders (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT, plan_snapshot jsonb NOT NULL,
      billing_cycle varchar(12) NOT NULL, amount numeric(18,4) NOT NULL CHECK(amount>=0), currency char(3) NOT NULL,
      status varchar(12) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PAID','VOID')),
      idempotency_key varchar(100) NOT NULL, created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,idempotency_key)
    )`);
    await r.query(`CREATE SEQUENCE billing_invoice_number_seq`);
    await r.query(`CREATE TABLE invoices (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), invoice_number varchar(40) NOT NULL UNIQUE,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      order_id uuid NOT NULL UNIQUE REFERENCES subscription_orders(id) ON DELETE RESTRICT,
      plan_snapshot jsonb NOT NULL, billing_cycle varchar(12) NOT NULL,
      subtotal numeric(18,4) NOT NULL CHECK(subtotal>=0), total numeric(18,4) NOT NULL CHECK(total>=0),
      currency char(3) NOT NULL, instruction_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
      issued_at timestamptz NOT NULL DEFAULT now(), due_at timestamptz NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','PARTIALLY_PAID','PAID','VOID')),
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT
    )`);
    await r.query(`CREATE TABLE invoice_items (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      description varchar(240) NOT NULL, quantity numeric(12,3) NOT NULL CHECK(quantity>0),
      unit_amount numeric(18,4) NOT NULL CHECK(unit_amount>=0), total numeric(18,4) NOT NULL CHECK(total>=0)
    )`);
    await r.query(`CREATE TABLE payment_submissions (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT, submitted_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      method varchar(16) NOT NULL CHECK(method IN ('BANK_TRANSFER','MOBILE_MONEY')),
      claimed_amount numeric(18,4) NOT NULL CHECK(claimed_amount>0), currency char(3) NOT NULL,
      reference varchar(160) NOT NULL, claimed_paid_at timestamptz NOT NULL,
      proof_storage_id uuid NOT NULL UNIQUE, proof_original_name varchar(255) NOT NULL, proof_mime varchar(32) NOT NULL,
      proof_sha256 char(64) NOT NULL, proof_size integer NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK(status IN ('PENDING_REVIEW','APPROVED','REJECTED')),
      duplicate_warning boolean NOT NULL DEFAULT false,
      reviewed_by uuid REFERENCES users(id) ON DELETE RESTRICT, reviewed_at timestamptz,
      verified_amount numeric(18,4) CHECK(verified_amount>=0), review_note text,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await r.query(
      `CREATE INDEX payment_submissions_review ON payment_submissions(status,created_at DESC)`,
    );
    await r.query(`CREATE TABLE payment_allocations (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), submission_id uuid NOT NULL UNIQUE REFERENCES payment_submissions(id) ON DELETE RESTRICT,
      invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
      amount numeric(18,4) NOT NULL CHECK(amount>0), allocated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await r.query(
      `ALTER TABLE subscription_periods ADD CONSTRAINT subscription_period_order_fk FOREIGN KEY(order_id) REFERENCES subscription_orders(id) ON DELETE RESTRICT`,
    );
    await r.query(
      `CREATE UNIQUE INDEX subscription_period_order_unique ON subscription_periods(order_id) WHERE order_id IS NOT NULL`,
    );
    await r.query(`CREATE TABLE audit_logs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), occurred_at timestamptz NOT NULL DEFAULT now(),
      actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT, actor_role varchar(20),
      organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT,
      action varchar(80) NOT NULL, entity_type varchar(80) NOT NULL, entity_id uuid,
      outcome varchar(16) NOT NULL DEFAULT 'SUCCESS', before_changes jsonb, after_changes jsonb,
      reason text, correlation_id uuid
    )`);
    await r.query(
      `CREATE INDEX audit_logs_time ON audit_logs(occurred_at DESC)`,
    );
    await r.query(`CREATE TABLE customer_activity (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), occurred_at timestamptz NOT NULL DEFAULT now(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      actor_user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
      equipment_id uuid REFERENCES equipment(id) ON DELETE RESTRICT,
      kind varchar(60) NOT NULL, message text NOT NULL, entity_type varchar(60), entity_id uuid
    )`);
    await r.query(
      `CREATE INDEX customer_activity_org_time ON customer_activity(organization_id,occurred_at DESC)`,
    );
    await r.query(`CREATE TABLE billing_reminders (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      kind varchar(24) NOT NULL, entity_id uuid NOT NULL, window_days integer NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(kind,entity_id,window_days)
    )`);
    await r.query(`INSERT INTO subscription_plans(code,name,description,monthly_price,quarterly_price,annual_price,currency,site_limit,equipment_limit,controller_limit,features,display_order)
      VALUES
      ('STARTER','Starter','Live monitoring and basic manual operations',30000,85500,306000,'TZS',1,3,2,'{"live_monitoring":true,"fuel_records":true}'::jsonb,1),
      ('OPERATIONS','Operations','Fuel, maintenance and full operational reports',75000,213750,765000,'TZS',5,15,10,'{"live_monitoring":true,"fuel_records":true,"fuel_estimates":true,"fuel_costs_reconciliation":true,"maintenance":true,"advanced_reports":true,"pdf_export":true}'::jsonb,2),
      ('BUSINESS','Business','Fleet analytics and all implemented operational capabilities',150000,427500,1530000,'TZS',20,50,25,'{"live_monitoring":true,"fuel_records":true,"fuel_estimates":true,"fuel_costs_reconciliation":true,"maintenance":true,"advanced_reports":true,"pdf_export":true,"fleet_analytics":true}'::jsonb,3)
      ON CONFLICT(code) DO NOTHING`);
  }
  public async down(r: QueryRunner): Promise<void> {
    for (const table of [
      'billing_reminders',
      'customer_activity',
      'audit_logs',
      'payment_allocations',
      'payment_submissions',
      'invoice_items',
      'invoices',
      'subscription_periods',
      'subscription_orders',
      'payment_instructions',
      'organization_subscriptions',
      'subscription_plans',
    ])
      await r.query(`DROP TABLE ${table}`);
    await r.query('DROP SEQUENCE billing_invoice_number_seq');
  }
}
