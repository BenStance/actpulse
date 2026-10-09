import { MigrationInterface, QueryRunner } from 'typeorm';

export class OperationalRecords1790842000000 implements MigrationInterface {
  name = 'OperationalRecords1790842000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE fuel_tanks (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid NOT NULL, generator_id uuid NOT NULL UNIQUE,
      name varchar(160) NOT NULL DEFAULT 'Dedicated tank',
      capacity_litres numeric(14,3) NOT NULL CHECK (capacity_litres > 0),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (organization_id,id),
      FOREIGN KEY (organization_id,generator_id) REFERENCES equipment(organization_id,id) ON DELETE RESTRICT
    )`);
    await runner.query(`INSERT INTO fuel_tanks (organization_id,generator_id,capacity_litres)
      SELECT organization_id,id,tank_capacity_litres FROM equipment
      WHERE type='GENERATOR' AND tank_capacity_litres IS NOT NULL AND tank_capacity_litres > 0`);
    await runner.query(`CREATE FUNCTION enforce_generator_tank() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM equipment WHERE id=NEW.generator_id AND organization_id=NEW.organization_id AND type='GENERATOR')
        THEN RAISE EXCEPTION 'Fuel tanks require generator equipment'; END IF;
        RETURN NEW;
      END $$`);
    await runner.query(`CREATE TRIGGER fuel_tank_generator_check BEFORE INSERT OR UPDATE ON fuel_tanks
      FOR EACH ROW EXECUTE FUNCTION enforce_generator_tank()`);
    await runner.query(`CREATE TABLE fuel_readings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tank_id uuid NOT NULL REFERENCES fuel_tanks(id) ON DELETE RESTRICT,
      observed_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
      level_litres numeric(14,3) NOT NULL CHECK (level_litres >= 0),
      source varchar(12) NOT NULL CHECK (source IN ('MANUAL','SENSOR')),
      method varchar(80), notes text, recorded_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      source_event_id varchar(120), voided_at timestamptz, voided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      void_reason text, corrected_from_id uuid REFERENCES fuel_readings(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((source='MANUAL' AND recorded_by IS NOT NULL) OR source='SENSOR')
    )`);
    await runner.query(`CREATE UNIQUE INDEX fuel_reading_source_event_unique ON fuel_readings(tank_id,source_event_id)
      WHERE source_event_id IS NOT NULL`);
    await runner.query(
      `CREATE INDEX fuel_readings_tank_time ON fuel_readings(tank_id,observed_at DESC)`,
    );
    await runner.query(`CREATE TABLE fuel_refills (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tank_id uuid NOT NULL REFERENCES fuel_tanks(id) ON DELETE RESTRICT,
      occurred_at timestamptz NOT NULL, quantity_litres numeric(14,3) NOT NULL CHECK (quantity_litres > 0),
      before_reading_id uuid REFERENCES fuel_readings(id) ON DELETE RESTRICT,
      after_reading_id uuid REFERENCES fuel_readings(id) ON DELETE RESTRICT,
      supplier varchar(160), reference varchar(160), notes text,
      currency char(3), unit_price numeric(18,4), fuel_amount numeric(18,4),
      additional_cost numeric(18,4), total_amount numeric(18,4),
      recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      voided_at timestamptz, voided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      void_reason text, corrected_from_id uuid REFERENCES fuel_refills(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((currency IS NULL AND unit_price IS NULL AND fuel_amount IS NULL AND additional_cost IS NULL AND total_amount IS NULL)
        OR (currency IS NOT NULL AND unit_price >= 0 AND fuel_amount >= 0 AND additional_cost >= 0 AND total_amount >= 0))
    )`);
    await runner.query(
      `CREATE INDEX fuel_refills_tank_time ON fuel_refills(tank_id,occurred_at DESC)`,
    );
    await runner.query(`CREATE TABLE fuel_adjustments (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tank_id uuid NOT NULL REFERENCES fuel_tanks(id) ON DELETE RESTRICT,
      occurred_at timestamptz NOT NULL, direction varchar(10) NOT NULL CHECK (direction IN ('ADDITION','REMOVAL')),
      quantity_litres numeric(14,3) NOT NULL CHECK (quantity_litres > 0),
      reason varchar(160) NOT NULL, notes text, reference varchar(160),
      recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      voided_at timestamptz, voided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      void_reason text, corrected_from_id uuid REFERENCES fuel_adjustments(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(
      `CREATE INDEX fuel_adjustments_tank_time ON fuel_adjustments(tank_id,occurred_at DESC)`,
    );
    await runner.query(`CREATE TABLE fuel_estimates (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), generator_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      estimated_litres_per_hour numeric(14,4) NOT NULL CHECK (estimated_litres_per_hour > 0),
      effective_from timestamptz NOT NULL, effective_to timestamptz,
      basis text NOT NULL, created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (effective_to IS NULL OR effective_to > effective_from)
    )`);
    await runner.query(
      `CREATE INDEX fuel_estimates_generator_time ON fuel_estimates(generator_id,effective_from)`,
    );
    await runner.query(`CREATE TABLE fuel_reconciliations (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), tank_id uuid NOT NULL REFERENCES fuel_tanks(id) ON DELETE RESTRICT,
      opening_reading_id uuid NOT NULL REFERENCES fuel_readings(id) ON DELETE RESTRICT,
      closing_reading_id uuid NOT NULL REFERENCES fuel_readings(id) ON DELETE RESTRICT,
      period_from timestamptz NOT NULL, period_to timestamptz NOT NULL,
      opening_litres numeric(14,3) NOT NULL, refill_litres numeric(14,3) NOT NULL,
      addition_litres numeric(14,3) NOT NULL, removal_litres numeric(14,3) NOT NULL,
      closing_litres numeric(14,3) NOT NULL, apparent_usage_litres numeric(14,3) NOT NULL,
      estimated_litres numeric(14,3), variance_litres numeric(14,3),
      review_flag varchar(40), included_refill_ids uuid[] NOT NULL DEFAULT '{}',
      included_adjustment_ids uuid[] NOT NULL DEFAULT '{}',
      status varchar(12) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','FINALIZED')),
      calculation_version integer NOT NULL DEFAULT 1,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      finalized_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      finalized_at timestamptz, finalization_note text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (period_to > period_from)
    )`);
    await runner.query(
      `CREATE INDEX fuel_reconciliations_tank_time ON fuel_reconciliations(tank_id,period_from,period_to)`,
    );
    await runner.query(`CREATE TABLE maintenance_plans (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      title varchar(160) NOT NULL, description text, checklist text,
      trigger_type varchar(12) NOT NULL CHECK (trigger_type IN ('CALENDAR','HOURS','BOTH')),
      interval_days integer CHECK (interval_days > 0), interval_hours numeric(14,3) CHECK (interval_hours > 0),
      reference_service_at timestamptz, reference_hours numeric(14,3),
      reminder_days integer NOT NULL DEFAULT 7 CHECK (reminder_days >= 0),
      reminder_hours numeric(14,3) NOT NULL DEFAULT 10 CHECK (reminder_hours >= 0),
      is_active boolean NOT NULL DEFAULT true,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE TABLE service_records (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      maintenance_plan_id uuid REFERENCES maintenance_plans(id) ON DELETE RESTRICT,
      performed_at timestamptz NOT NULL, description text NOT NULL, completed_checklist text,
      technician varchar(160), meter_hours numeric(14,3) CHECK (meter_hours >= 0),
      observed_hours numeric(14,3), hour_basis varchar(32),
      cost numeric(18,4) CHECK (cost >= 0), currency char(3), reference varchar(160), notes text,
      resets_plan_baseline boolean NOT NULL DEFAULT false,
      recorded_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      voided_at timestamptz, voided_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      void_reason text, corrected_from_id uuid REFERENCES service_records(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK ((cost IS NULL AND currency IS NULL) OR (cost IS NOT NULL AND currency IS NOT NULL))
    )`);
    await runner.query(
      `CREATE INDEX service_records_equipment_time ON service_records(equipment_id,performed_at DESC)`,
    );
    await runner.query(`CREATE TABLE alert_rules (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id uuid REFERENCES organizations(id) ON DELETE RESTRICT,
      equipment_id uuid REFERENCES equipment(id) ON DELETE RESTRICT,
      type varchar(32) NOT NULL CHECK (type IN ('MONITOR_OFFLINE','LOW_FUEL','STALE_FUEL','MAINTENANCE_DUE','RECONCILIATION_VARIANCE')),
      severity varchar(12) NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
      threshold numeric(14,3), freshness_minutes integer CHECK (freshness_minutes > 0),
      debounce_minutes integer NOT NULL DEFAULT 0 CHECK (debounce_minutes >= 0),
      enabled boolean NOT NULL DEFAULT true,
      in_app boolean NOT NULL DEFAULT true, email boolean NOT NULL DEFAULT false,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE TABLE alerts (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE RESTRICT,
      type varchar(32) NOT NULL, severity varchar(12) NOT NULL,
      message text NOT NULL, context jsonb NOT NULL DEFAULT '{}',
      triggered_at timestamptz NOT NULL DEFAULT now(),
      status varchar(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
      acknowledged_by uuid REFERENCES users(id) ON DELETE RESTRICT,
      acknowledged_at timestamptz, acknowledgement_note text,
      resolved_at timestamptz, resolution_reason text,
      deduplication_key varchar(200) NOT NULL
    )`);
    await runner.query(
      `CREATE UNIQUE INDEX alerts_active_dedup ON alerts(deduplication_key) WHERE status <> 'RESOLVED'`,
    );
    await runner.query(
      `CREATE INDEX alerts_equipment_time ON alerts(equipment_id,triggered_at DESC)`,
    );
    await runner.query(`CREATE TABLE notifications (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      alert_id uuid REFERENCES alerts(id) ON DELETE RESTRICT,
      title varchar(160) NOT NULL, message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
      delivery_status varchar(16) NOT NULL DEFAULT 'IN_APP',
      UNIQUE(user_id,alert_id)
    )`);
    await runner.query(
      `CREATE INDEX notifications_user_unread ON notifications(user_id,created_at DESC) WHERE read_at IS NULL`,
    );
    await runner.query(`CREATE TABLE notification_preferences (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      in_app boolean NOT NULL DEFAULT true,
      email boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await runner.query(`CREATE TABLE operational_audit (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      entity_type varchar(60) NOT NULL, entity_id uuid NOT NULL,
      action varchar(40) NOT NULL, reason text, before_data jsonb, after_data jsonb,
      occurred_at timestamptz NOT NULL DEFAULT now()
    )`);
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Operational history migration requires a reviewed data-retention rollback',
      ),
    );
  }
}
