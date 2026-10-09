import { createHash } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SitesEquipmentMonitoring1790841900000 implements MigrationInterface {
  name = 'SitesEquipmentMonitoring1790841900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE sites (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      name varchar(160) NOT NULL,
      site_code varchar(80), description text, address text, city_region varchar(160),
      latitude numeric(9,6), longitude numeric(9,6),
      timezone varchar(100) NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
      contact_name varchar(160), contact_phone varchar(40),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT sites_latitude_range CHECK (latitude BETWEEN -90 AND 90),
      CONSTRAINT sites_longitude_range CHECK (longitude BETWEEN -180 AND 180),
      CONSTRAINT sites_org_id_unique UNIQUE (organization_id,id)
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX sites_org_code_unique ON sites (organization_id,lower(site_code)) WHERE site_code IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX sites_org_active_idx ON sites (organization_id,is_active)',
    );
    await queryRunner.query(`INSERT INTO sites (organization_id,name,description)
      SELECT DISTINCT organization_id,coalesce(nullif(trim(location),''),'Legacy default site'),
        'Created from legacy location text; original text remains on the monitor record'
      FROM devices`);
    await queryRunner.query(`CREATE TABLE equipment (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
      site_id uuid NOT NULL,
      type varchar(20) NOT NULL DEFAULT 'UNSPECIFIED',
      monitoring_definition varchar(32),
      name varchar(160) NOT NULL, legacy_device_id uuid UNIQUE,
      asset_tag varchar(100), manufacturer varchar(160),
      model varchar(160), serial_number varchar(160), installation_date date, description text,
      rated_capacity_kva numeric(12,3), fuel_type varchar(80), tank_capacity_litres numeric(12,3),
      opening_running_hours numeric(14,3), opening_hours_at timestamptz, service_interval_hours numeric(12,3),
      rated_capacity_kw numeric(12,3), battery_capacity_ah numeric(12,3),
      nominal_battery_voltage numeric(12,3), battery_notes text,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT equipment_org_id_unique UNIQUE (organization_id,id),
      CONSTRAINT equipment_site_org_fk FOREIGN KEY (organization_id,site_id) REFERENCES sites(organization_id,id) ON DELETE RESTRICT,
      CONSTRAINT equipment_type_check CHECK (type IN ('GENERATOR','UPS','UNSPECIFIED')),
      CONSTRAINT equipment_definition_check CHECK (monitoring_definition IN ('OUTPUT_POWER_PRESENT','ENGINE_RUNNING') OR monitoring_definition IS NULL),
      CONSTRAINT equipment_ups_definition_check CHECK (type <> 'UPS' OR monitoring_definition = 'OUTPUT_POWER_PRESENT'),
      CONSTRAINT equipment_capacity_positive CHECK (
        (rated_capacity_kva IS NULL OR rated_capacity_kva > 0) AND
        (tank_capacity_litres IS NULL OR tank_capacity_litres > 0) AND
        (service_interval_hours IS NULL OR service_interval_hours > 0) AND
        (rated_capacity_kw IS NULL OR rated_capacity_kw > 0) AND
        (battery_capacity_ah IS NULL OR battery_capacity_ah > 0) AND
        (nominal_battery_voltage IS NULL OR nominal_battery_voltage > 0) AND
        (opening_running_hours IS NULL OR opening_running_hours >= 0))
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX equipment_org_asset_tag_unique ON equipment (organization_id,lower(asset_tag)) WHERE asset_tag IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX equipment_site_idx ON equipment (site_id)',
    );
    await queryRunner.query(`INSERT INTO equipment
      (organization_id,site_id,type,monitoring_definition,name,legacy_device_id,description,is_active,created_at,updated_at)
      SELECT d.organization_id,s.id,'UNSPECIFIED',NULL,d.name,d.id,
        'Migrated from monitoring device. Original location: ' || coalesce(nullif(d.location,''),'(missing)'),
        d.is_active,d.created_at AT TIME ZONE 'UTC',d.updated_at AT TIME ZONE 'UTC'
      FROM devices d JOIN sites s ON s.organization_id=d.organization_id
        AND s.name=coalesce(nullif(trim(d.location),''),'Legacy default site')`);
    await queryRunner.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM devices d LEFT JOIN equipment e ON e.legacy_device_id=d.id WHERE e.id IS NULL) THEN
        RAISE EXCEPTION 'Ambiguous legacy equipment mapping; migration stopped without data loss';
      END IF;
    END $$`);
    await queryRunner.query(
      'ALTER TABLE devices ADD COLUMN current_equipment_id uuid',
    );
    await queryRunner.query(
      'UPDATE devices d SET current_equipment_id=e.id FROM equipment e WHERE e.legacy_device_id=d.id',
    );
    await queryRunner.query(
      'ALTER TABLE equipment DROP COLUMN legacy_device_id',
    );
    await queryRunner.query(
      'ALTER TABLE devices ADD CONSTRAINT devices_equipment_org_fk FOREIGN KEY (organization_id,current_equipment_id) REFERENCES equipment(organization_id,id) ON DELETE RESTRICT',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX devices_current_equipment_unique ON devices(current_equipment_id) WHERE current_equipment_id IS NOT NULL',
    );
    await queryRunner.query(`CREATE TABLE device_bindings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), device_id uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
      equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      started_at timestamptz NOT NULL, ended_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT device_bindings_period_check CHECK (ended_at IS NULL OR ended_at > started_at)
    )`);
    await queryRunner.query(
      'CREATE UNIQUE INDEX device_bindings_current_equipment_unique ON device_bindings(equipment_id) WHERE ended_at IS NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX device_bindings_current_device_unique ON device_bindings(device_id) WHERE ended_at IS NULL',
    );
    await queryRunner.query(`INSERT INTO device_bindings (device_id,equipment_id,started_at)
      SELECT d.id,d.current_equipment_id,d.created_at AT TIME ZONE 'UTC' FROM devices d`);
    await queryRunner.query(`CREATE TABLE user_equipment (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      equipment_id uuid NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
      PRIMARY KEY (user_id,equipment_id)
    )`);
    await queryRunner.query(`INSERT INTO user_equipment (user_id,equipment_id)
      SELECT DISTINCT ud.user_id,d.current_equipment_id FROM user_devices ud
      JOIN devices d ON d.id=ud.device_id`);
    await queryRunner.query(
      'CREATE INDEX user_equipment_equipment_idx ON user_equipment(equipment_id)',
    );

    await queryRunner.query(`ALTER TABLE devices
      ADD COLUMN device_identifier varchar(120),
      ADD COLUMN hardware_model varchar(160), ADD COLUMN firmware_version varchar(100),
      ADD COLUMN lifecycle_state varchar(20) NOT NULL DEFAULT 'ACTIVE',
      ADD COLUMN credential_id varchar(80), ADD COLUMN credential_hash char(64),
      ADD COLUMN first_seen_at timestamptz, ADD COLUMN last_seen_at timestamptz,
      ADD COLUMN last_status_at timestamptz, ADD COLUMN connected_since_at timestamptz,
      ADD COLUMN connectivity_state varchar(20) NOT NULL DEFAULT 'NEVER_CONNECTED',
      ADD COLUMN heartbeat_interval_seconds integer NOT NULL DEFAULT 30,
      ADD COLUMN offline_timeout_seconds integer NOT NULL DEFAULT 120,
      ADD COLUMN provisioned_at timestamptz, ADD COLUMN rotated_at timestamptz,
      ADD CONSTRAINT devices_lifecycle_check CHECK (lifecycle_state IN ('UNPROVISIONED','ACTIVE','DISABLED','RETIRED')),
      ADD CONSTRAINT devices_connectivity_check CHECK (connectivity_state IN ('NEVER_CONNECTED','ONLINE','OFFLINE')),
      ADD CONSTRAINT devices_intervals_check CHECK (heartbeat_interval_seconds BETWEEN 10 AND 3600 AND offline_timeout_seconds BETWEEN 30 AND 86400 AND offline_timeout_seconds > heartbeat_interval_seconds)`);
    const legacyKeys = (await queryRunner.query(
      'SELECT id,api_key FROM devices',
    )) as Array<{ id: string; api_key: string }>;
    for (const row of legacyKeys) {
      const digest = createHash('sha256').update(row.api_key).digest('hex');
      await queryRunner.query(
        `UPDATE devices SET device_identifier=$1,credential_id=$2,credential_hash=$3,
        provisioned_at=created_at AT TIME ZONE 'UTC' WHERE id=$4`,
        [`legacy-${row.id}`, `legacy-${row.id}`, digest, row.id],
      );
    }
    await queryRunner.query(
      'ALTER TABLE devices ALTER COLUMN device_identifier SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE devices DROP CONSTRAINT IF EXISTS "UQ_devices_api_key"',
    );
    await queryRunner.query('ALTER TABLE devices DROP COLUMN api_key');
    await queryRunner.query(
      'CREATE UNIQUE INDEX devices_identifier_unique ON devices(device_identifier)',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX devices_credential_id_unique ON devices(credential_id) WHERE credential_id IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX devices_credential_hash_unique ON devices(credential_hash) WHERE credential_hash IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX devices_last_seen_idx ON devices(last_seen_at)',
    );
    await queryRunner.query(`CREATE TABLE device_key_audit (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), device_id uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
      actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      action varchar(20) NOT NULL CHECK (action IN ('PROVISION','ROTATE')),
      occurred_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(`CREATE TABLE monitor_connectivity_events (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(), device_id uuid NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
      equipment_id uuid REFERENCES equipment(id) ON DELETE RESTRICT,
      type varchar(20) NOT NULL CHECK (type IN ('FIRST_CONTACT','ONLINE','OFFLINE')),
      occurred_at timestamptz NOT NULL DEFAULT now()
    )`);
    await queryRunner.query(
      'CREATE INDEX monitor_connectivity_events_device_time ON monitor_connectivity_events(device_id,occurred_at DESC)',
    );

    await queryRunner.query(`ALTER TABLE sensor_logs
      ALTER COLUMN recorded_at TYPE timestamptz USING recorded_at AT TIME ZONE 'UTC',
      ADD COLUMN equipment_id uuid,
      ADD COLUMN received_at timestamptz,
      ADD COLUMN timestamp_basis varchar(20) NOT NULL DEFAULT 'RECEIVED',
      ADD COLUMN source varchar(20) NOT NULL DEFAULT 'DEVICE',
      ADD COLUMN event_id varchar(120),
      ADD COLUMN kind varchar(20) NOT NULL DEFAULT 'TRANSITION'`);
    await queryRunner.query(`UPDATE sensor_logs l SET equipment_id=d.current_equipment_id,received_at=l.recorded_at
      FROM devices d WHERE d.id=l.device_id`);
    await queryRunner.query(
      'ALTER TABLE sensor_logs ALTER COLUMN equipment_id SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE sensor_logs ALTER COLUMN received_at SET NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE sensor_logs ALTER COLUMN received_at SET DEFAULT now()',
    );
    await queryRunner.query(
      'ALTER TABLE sensor_logs ADD CONSTRAINT sensor_logs_equipment_fk FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE RESTRICT',
    );
    await queryRunner.query(
      "ALTER TABLE sensor_logs ADD CONSTRAINT sensor_logs_source_check CHECK (source IN ('DEVICE','SIMULATOR'))",
    );
    await queryRunner.query(
      "ALTER TABLE sensor_logs ADD CONSTRAINT sensor_logs_basis_check CHECK (timestamp_basis IN ('RECEIVED','DEVICE'))",
    );
    await queryRunner.query(
      "ALTER TABLE sensor_logs ADD CONSTRAINT sensor_logs_kind_check CHECK (kind IN ('TRANSITION','CONFIRMATION'))",
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX sensor_logs_device_event_unique ON sensor_logs(device_id,event_id) WHERE event_id IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE INDEX sensor_logs_equipment_time_idx ON sensor_logs(equipment_id,recorded_at,id)',
    );
    await queryRunner.query(
      'CREATE INDEX sensor_logs_device_time_idx ON sensor_logs(device_id,recorded_at DESC)',
    );
    await queryRunner.query(`UPDATE devices d SET
      first_seen_at=history.first_seen,last_seen_at=history.last_seen,
      last_status_at=history.last_seen,connected_since_at=history.last_seen,
      connectivity_state=CASE WHEN history.last_seen + interval '120 seconds' > now() THEN 'ONLINE' ELSE 'OFFLINE' END
      FROM (SELECT device_id,min(received_at) first_seen,max(received_at) last_seen FROM sensor_logs GROUP BY device_id) history
      WHERE d.id=history.device_id`);
    await queryRunner.query(`INSERT INTO monitor_connectivity_events(device_id,equipment_id,type,occurred_at)
      SELECT id,current_equipment_id,'FIRST_CONTACT',first_seen_at FROM devices WHERE first_seen_at IS NOT NULL`);
    await queryRunner.query(`INSERT INTO monitor_connectivity_events(device_id,equipment_id,type,occurred_at)
      SELECT id,current_equipment_id,'OFFLINE',last_seen_at + (offline_timeout_seconds * interval '1 second')
      FROM devices WHERE connectivity_state='OFFLINE'`);
    await queryRunner.query(
      'ALTER TABLE sensor_logs DROP CONSTRAINT IF EXISTS "FK_sensor_logs_device_id"',
    );
    await queryRunner.query(
      'ALTER TABLE sensor_logs ADD CONSTRAINT sensor_logs_device_restrict_fk FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE RESTRICT',
    );
  }

  down(): Promise<void> {
    return Promise.reject(
      new Error(
        'Phase 02 monitoring migration is not reversible without risking equipment and credential history',
      ),
    );
  }
}
