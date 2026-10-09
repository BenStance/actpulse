import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import AppDataSource from '../../ormconfig';

type Row = Record<string, unknown>;
type Plan = Row & {
  id: string;
  code: string;
  name: string;
  currency: string;
  monthly_price: string;
  quarterly_price: string;
  annual_price: string;
  site_limit: number;
  equipment_limit: number;
  controller_limit: number;
  features: Record<string, boolean>;
};
type Scenario = {
  name: string;
  slug: string;
  plan: 'STARTER' | 'OPERATIONS' | 'BUSINESS';
  cycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  status: 'ACTIVE' | 'TRIALING' | 'EXPIRED' | 'GRACE';
  sites: string[];
  equipment: Array<{ site: number; type: 'GENERATOR' | 'UPS'; name: string }>;
};

const scenarios: Scenario[] = [
  {
    name: 'ACTPulse Demo — Kilima Retail',
    slug: 'kilima',
    plan: 'STARTER',
    cycle: 'MONTHLY',
    status: 'ACTIVE',
    sites: ['Dar es Salaam Store'],
    equipment: [
      { site: 0, type: 'GENERATOR', name: 'Store Backup Generator' },
      { site: 0, type: 'UPS', name: 'Checkout UPS' },
    ],
  },
  {
    name: 'ACTPulse Demo — Bahari Logistics',
    slug: 'bahari',
    plan: 'OPERATIONS',
    cycle: 'QUARTERLY',
    status: 'ACTIVE',
    sites: ['Port Warehouse', 'Dispatch Hub'],
    equipment: [
      { site: 0, type: 'GENERATOR', name: 'Warehouse Generator' },
      { site: 1, type: 'GENERATOR', name: 'Dispatch Generator' },
      { site: 1, type: 'UPS', name: 'Dispatch UPS' },
    ],
  },
  {
    name: 'ACTPulse Demo — Serengeti Estates',
    slug: 'serengeti',
    plan: 'BUSINESS',
    cycle: 'ANNUALLY',
    status: 'TRIALING',
    sites: ['Mwanza Office', 'Arusha Property'],
    equipment: [
      { site: 0, type: 'GENERATOR', name: 'Office Generator' },
      { site: 1, type: 'UPS', name: 'Property UPS' },
    ],
  },
  {
    name: 'ACTPulse Demo — Delta Clinics',
    slug: 'delta',
    plan: 'OPERATIONS',
    cycle: 'MONTHLY',
    status: 'EXPIRED',
    sites: ['Central Clinic', 'Outpatient Wing'],
    equipment: [
      { site: 0, type: 'GENERATOR', name: 'Emergency Generator' },
      { site: 1, type: 'UPS', name: 'Lab UPS' },
    ],
  },
  {
    name: 'ACTPulse Demo — Tanga Cold Chain',
    slug: 'tanga',
    plan: 'BUSINESS',
    cycle: 'MONTHLY',
    status: 'GRACE',
    sites: ['Cold Store', 'Loading Yard'],
    equipment: [
      { site: 0, type: 'GENERATOR', name: 'Cold Store Generator' },
      { site: 1, type: 'UPS', name: 'Control Room UPS' },
    ],
  },
];

const day = 86400000;
const ago = (days: number) => new Date(Date.now() - days * day);
const later = (days: number) => new Date(Date.now() + days * day);
const proofBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXsAAAAASUVORK5CYII=',
  'base64',
);
const credentialFile = resolve(
  process.env.DEMO_CREDENTIAL_FILE ||
    join(process.cwd(), '..', 'seeded-organization-credentials.txt'),
);
const proofDir = resolve(
  process.env.PROOF_STORAGE_DIR || join(process.cwd(), 'storage', 'proofs'),
);

function snapshot(plan: Plan) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    currency: plan.currency,
    siteLimit: Number(plan.site_limit),
    equipmentLimit: Number(plan.equipment_limit),
    controllerLimit: Number(plan.controller_limit),
    features: plan.features,
  };
}
function price(plan: Plan, cycle: Scenario['cycle']): string {
  return cycle === 'MONTHLY'
    ? plan.monthly_price
    : cycle === 'QUARTERLY'
      ? plan.quarterly_price
      : plan.annual_price;
}

async function main() {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  const files: string[] = [];
  let tempFile = '';
  let committed = false;
  try {
    const expected = scenarios.map((scenario) => scenario.name);
    const existing = (await runner.query(
      'SELECT name FROM organizations WHERE name=ANY($1::text[])',
      [expected],
    )) as Array<{ name: string }>;
    if (existing.length) {
      if (
        existing.length === scenarios.length &&
        (await stat(credentialFile)
          .then(() => true)
          .catch(() => false))
      ) {
        console.log('Five demo organizations already exist; no changes made.');
        return;
      }
      throw new Error(
        'Some demo organizations already exist. Inspect them before rerunning; no changes made.',
      );
    }
    if (
      await stat(credentialFile)
        .then(() => true)
        .catch(() => false)
    )
      throw new Error('Credential file already exists; no changes made.');
    const admins = (await runner.query(
      "SELECT id FROM users WHERE role='Admin' AND is_active=true AND is_activated=true ORDER BY created_at LIMIT 1",
    )) as Array<{ id: string }>;
    if (!admins.length)
      throw new Error(
        'An active Admin account is required to seed audit ownership.',
      );
    const adminId = admins[0].id;
    const plans = (await runner.query(
      'SELECT * FROM subscription_plans WHERE code=ANY($1::text[])',
      [['STARTER', 'OPERATIONS', 'BUSINESS']],
    )) as Plan[];
    if (plans.length !== 3)
      throw new Error('Seed the three subscription plans first.');
    const planByCode = new Map(plans.map((plan) => [plan.code, plan]));
    const credentials: string[] = [
      'ACTPulse DEMO ORGANIZATION CREDENTIALS',
      'Generated: ' + new Date().toISOString(),
      'Local development data only. This file is excluded from Git and has owner-only permissions.',
      'Demo payment proofs are illustrative 1-pixel PNGs; no real funds were transferred.',
      '',
    ];
    await mkdir(proofDir, { recursive: true, mode: 0o700 });
    await runner.startTransaction();
    for (const [index, scenario] of scenarios.entries()) {
      const plan = planByCode.get(scenario.plan)!;
      const snap = snapshot(plan);
      const orgId = randomUUID();
      const controllerId = randomUUID();
      const email = `${scenario.slug}.controller@actpulse-demo.local`;
      const password = `Demo-${randomBytes(12).toString('base64url')}!`;
      const passwordHash = await bcrypt.hash(password, 12);
      await runner.query(
        `INSERT INTO organizations(id,name,contact_email,is_active,created_at) VALUES($1,$2,$3,true,$4)`,
        [orgId, scenario.name, email, ago(30.3 - index * 0.05)],
      );
      await runner.query(
        `INSERT INTO users(id,name,email,password,role,is_active,is_activated,organization_id,created_at)
         VALUES($1,$2,$3,$4,'Controller',true,true,$5,$6)`,
        [
          controllerId,
          `${scenario.slug[0].toUpperCase()}${scenario.slug.slice(1)} Demo Controller`,
          email,
          passwordHash,
          orgId,
          ago(30.2 - index * 0.05),
        ],
      );
      const siteIds: string[] = [];
      for (const [siteIndex, siteName] of scenario.sites.entries()) {
        const siteId = randomUUID();
        siteIds.push(siteId);
        await runner.query(
          `INSERT INTO sites(id,organization_id,name,site_code,city_region,address,timezone,contact_name,is_active,created_at)
           VALUES($1,$2,$3,$4,$5,$6,'Africa/Dar_es_Salaam',$7,true,$8)`,
          [
            siteId,
            orgId,
            siteName,
            `DEMO-${scenario.slug.toUpperCase()}-${siteIndex + 1}`,
            siteIndex ? 'Arusha' : 'Dar es Salaam',
            'Demo site address',
            `${scenario.slug} Controller`,
            ago(30.1),
          ],
        );
      }
      const equipmentIds: string[] = [];
      const deviceCredentials: Array<{ name: string; key: string }> = [];
      let firstGenerator: { equipmentId: string; tankId: string } | null = null;
      for (const [equipmentIndex, item] of scenario.equipment.entries()) {
        const equipmentId = randomUUID();
        const deviceId = randomUUID();
        const siteId = siteIds[item.site];
        const deviceSecret = randomBytes(32).toString('base64url');
        const identifier = randomBytes(8).toString('hex');
        const apiKey = `ap_${identifier}.${deviceSecret}`;
        const keyHash = createHash('sha256').update(apiKey).digest('hex');
        const offline =
          equipmentIndex === scenario.equipment.length - 1 && index % 2 === 1;
        const lastContact = offline ? ago(0.17) : new Date(Date.now() - 30000);
        equipmentIds.push(equipmentId);
        deviceCredentials.push({ name: item.name, key: apiKey });
        await runner.query(
          `INSERT INTO equipment(id,organization_id,site_id,type,monitoring_definition,name,asset_tag,manufacturer,model,
           rated_capacity_kva,fuel_type,tank_capacity_litres,opening_running_hours,opening_hours_at,service_interval_hours,
           rated_capacity_kw,battery_capacity_ah,nominal_battery_voltage,is_active,created_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,true,$19)`,
          [
            equipmentId,
            orgId,
            siteId,
            item.type,
            item.type === 'GENERATOR'
              ? 'ENGINE_RUNNING'
              : 'OUTPUT_POWER_PRESENT',
            item.name,
            `DEMO-${scenario.slug.toUpperCase()}-${equipmentIndex + 1}`,
            item.type === 'GENERATOR' ? 'Cummins' : 'APC',
            item.type === 'GENERATOR' ? 'C80D5' : 'Smart-UPS',
            item.type === 'GENERATOR' ? 80 : null,
            item.type === 'GENERATOR' ? 'Diesel' : null,
            item.type === 'GENERATOR' ? 500 : null,
            item.type === 'GENERATOR' ? 1200 : null,
            item.type === 'GENERATOR' ? ago(31) : null,
            item.type === 'GENERATOR' ? 250 : null,
            item.type === 'UPS' ? 20 : null,
            item.type === 'UPS' ? 100 : null,
            item.type === 'UPS' ? 48 : null,
            ago(30),
          ],
        );
        await runner.query(
          'INSERT INTO user_equipment(user_id,equipment_id) VALUES($1,$2)',
          [controllerId, equipmentId],
        );
        await runner.query(
          `INSERT INTO devices(id,name,location,organization_id,current_equipment_id,device_identifier,hardware_model,firmware_version,
           lifecycle_state,is_active,credential_id,credential_hash,heartbeat_interval_seconds,offline_timeout_seconds,
           first_seen_at,last_seen_at,last_status_at,connected_since_at,connectivity_state,provisioned_at,created_at)
           VALUES($1,$2,$3,$4,$5,$6,'ACTPulse Demo Monitor','demo-1.0','ACTIVE',true,$7,$8,30,120,$9,$10,$10,$9,$11,$12,$13)`,
          [
            deviceId,
            `${item.name} Monitor`,
            scenario.sites[item.site],
            orgId,
            equipmentId,
            `DEMO-${scenario.slug.toUpperCase()}-MON-${equipmentIndex + 1}`,
            identifier,
            keyHash,
            ago(30),
            lastContact,
            offline ? 'OFFLINE' : 'ONLINE',
            ago(30),
            ago(30),
          ],
        );
        await runner.query(
          'INSERT INTO device_bindings(device_id,equipment_id,started_at) VALUES($1,$2,$3)',
          [deviceId, equipmentId, ago(30)],
        );
        await runner.query(
          "INSERT INTO device_key_audit(device_id,actor_id,action) VALUES($1,$2,'PROVISION')",
          [deviceId, adminId],
        );
        await runner.query(
          "INSERT INTO monitor_connectivity_events(device_id,equipment_id,type,occurred_at) VALUES($1,$2,'FIRST_CONTACT',$3),($1,$2,'ONLINE',$3)",
          [deviceId, equipmentId, ago(30)],
        );
        if (offline)
          await runner.query(
            "INSERT INTO monitor_connectivity_events(device_id,equipment_id,type,occurred_at) VALUES($1,$2,'OFFLINE',$3)",
            [deviceId, equipmentId, lastContact],
          );
        await seedSensorMonth(
          runner,
          deviceId,
          equipmentId,
          scenario.slug,
          equipmentIndex,
          lastContact,
        );
        if (item.type === 'GENERATOR') {
          const tankId = randomUUID();
          if (!firstGenerator) firstGenerator = { equipmentId, tankId };
          await runner.query(
            'INSERT INTO fuel_tanks(id,organization_id,generator_id,name,capacity_litres) VALUES($1,$2,$3,$4,500)',
            [tankId, orgId, equipmentId, `${item.name} Tank`],
          );
          await seedFuelMonth(
            runner,
            tankId,
            equipmentId,
            controllerId,
            scenario.slug,
            equipmentIndex,
          );
        }
        await seedMaintenanceAndAlerts(
          runner,
          orgId,
          controllerId,
          equipmentId,
          item,
          scenario.slug,
          equipmentIndex,
        );
      }
      if (firstGenerator)
        await seedReconciliations(
          runner,
          firstGenerator.tankId,
          controllerId,
          scenario.slug,
        );
      await seedBilling(
        runner,
        scenario,
        orgId,
        controllerId,
        adminId,
        plan,
        snap,
        files,
      );
      await runner.query(
        `INSERT INTO audit_logs(actor_user_id,actor_role,organization_id,action,entity_type,entity_id,occurred_at)
         VALUES($1,'Controller',$2,'RECONCILIATION_FINALIZED','organization',$2,$3)`,
        [controllerId, orgId, ago(2 + index * 0.1)],
      );
      await runner.query(
        `INSERT INTO customer_activity(organization_id,actor_user_id,kind,message,entity_type,entity_id,occurred_at)
         VALUES($1,$2,'DEMO_SETUP','Demo monitoring and billing history loaded','organization',$1,$3)`,
        [orgId, controllerId, ago(1)],
      );
      credentials.push(
        `${scenario.name}\nStatus: ${scenario.status}\nPlan: ${scenario.plan} / ${scenario.cycle}\nOrganization ID: ${orgId}\nController login: ${email}\nPassword: ${password}\nMonitor API keys (demo only):`,
        ...deviceCredentials.map((device) => `  ${device.name}: ${device.key}`),
        '',
      );
      console.log(
        `Prepared ${index + 1}/5: ${scenario.name} (${scenario.status})`,
      );
    }
    tempFile = `${credentialFile}.${randomUUID()}.tmp`;
    await writeFile(tempFile, credentials.join('\n') + '\n', {
      mode: 0o600,
      flag: 'wx',
    });
    await runner.commitTransaction();
    committed = true;
    await rename(tempFile, credentialFile);
    tempFile = '';
    console.log(
      'Seed committed: five demo organizations, 30 days of equipment records, billing and operations.',
    );
    console.log(
      'Credentials written to seeded-organization-credentials.txt (owner-only permissions).',
    );
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    if (!committed) {
      if (tempFile) await rm(tempFile, { force: true });
      for (const file of files) await rm(file, { force: true });
    }
    throw error;
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

async function seedSensorMonth(
  runner: ReturnType<typeof AppDataSource.createQueryRunner>,
  deviceId: string,
  equipmentId: string,
  slug: string,
  index: number,
  lastContact: Date,
) {
  const values: unknown[] = [];
  const placeholders: string[] = [];
  const start = Date.now() - 30 * day;
  for (let step = 0; step < 120; step += 1) {
    const at = new Date(start + step * 6 * 3600000);
    if (at >= lastContact) break;
    const status = (Math.floor(step / 2) + index) % 3 === 0 ? 'OFF' : 'ON';
    const n = values.length;
    placeholders.push(
      `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 4},'RECEIVED','SIMULATOR',$${n + 5},'TRANSITION')`,
    );
    values.push(
      deviceId,
      equipmentId,
      status,
      at,
      `demo-${slug}-${index}-${step}`,
    );
  }
  const lastStatus = index % 3 === 0 ? 'ON' : 'OFF';
  const n = values.length;
  placeholders.push(
    `($${n + 1},$${n + 2},$${n + 3},$${n + 4},$${n + 4},'RECEIVED','SIMULATOR',$${n + 5},'CONFIRMATION')`,
  );
  values.push(
    deviceId,
    equipmentId,
    lastStatus,
    lastContact,
    `demo-${slug}-${index}-latest`,
  );
  await runner.query(
    `INSERT INTO sensor_logs(device_id,equipment_id,status,recorded_at,received_at,timestamp_basis,source,event_id,kind) VALUES ${placeholders.join(',')}`,
    values,
  );
}

async function seedFuelMonth(
  runner: ReturnType<typeof AppDataSource.createQueryRunner>,
  tankId: string,
  generatorId: string,
  actorId: string,
  slug: string,
  index: number,
) {
  const readings: string[] = [];
  for (let week = 0; week < 5; week += 1) {
    const at = ago(29 - week * 7);
    const readingId = randomUUID();
    readings.push(readingId);
    await runner.query(
      `INSERT INTO fuel_readings(id,tank_id,observed_at,level_litres,source,method,notes,recorded_by)
       VALUES($1,$2,$3,$4,'MANUAL','Dipstick','Demo weekly observation',$5)`,
      [readingId, tankId, at, 330 - week * 18 + index * 5, actorId],
    );
    if (week < 4)
      await runner.query(
        `INSERT INTO fuel_refills(tank_id,occurred_at,quantity_litres,supplier,reference,currency,unit_price,fuel_amount,additional_cost,total_amount,recorded_by)
       VALUES($1,$2,$3,'ACTPulse Demo Supplier',$4,'TZS',3200,$5,5000,$6,$7)`,
        [
          tankId,
          ago(27 - week * 7),
          70 + index * 5,
          `DEMO-${slug}-${index}-${week}`,
          (70 + index * 5) * 3200,
          (70 + index * 5) * 3200 + 5000,
          actorId,
        ],
      );
  }
  await runner.query(
    `INSERT INTO fuel_estimates(generator_id,estimated_litres_per_hour,effective_from,basis,created_by)
     VALUES($1,$2,$3,'Demo manufacturer estimate',$4)`,
    [generatorId, 7.5 + index, ago(31), actorId],
  );
  return readings;
}

async function seedReconciliations(
  runner: ReturnType<typeof AppDataSource.createQueryRunner>,
  tankId: string,
  actorId: string,
  slug: string,
) {
  const readings = (await runner.query(
    'SELECT id,observed_at,level_litres FROM fuel_readings WHERE tank_id=$1 ORDER BY observed_at',
    [tankId],
  )) as Array<{
    id: string;
    observed_at: Date;
    level_litres: string;
  }>;
  const refills = (await runner.query(
    'SELECT id,quantity_litres FROM fuel_refills WHERE tank_id=$1 AND occurred_at>$2 AND occurred_at<=$3 ORDER BY occurred_at',
    [tankId, readings[0].observed_at, readings[2].observed_at],
  )) as Array<{ id: string; quantity_litres: string }>;
  const refillLitres = refills.reduce(
    (sum, row) => sum + Number(row.quantity_litres),
    0,
  );
  const apparent =
    Number(readings[0].level_litres) +
    refillLitres -
    Number(readings[2].level_litres);
  await runner.query(
    `INSERT INTO fuel_reconciliations(tank_id,opening_reading_id,closing_reading_id,period_from,period_to,
     opening_litres,refill_litres,addition_litres,removal_litres,closing_litres,apparent_usage_litres,
     estimated_litres,variance_litres,included_refill_ids,status,created_by,finalized_by,finalized_at,finalization_note)
     VALUES($1,$2,$3,$4,$5,$6,$7,0,0,$8,$9,$10,$11,$12,'FINALIZED',$13,$13,$14,$15)`,
    [
      tankId,
      readings[0].id,
      readings[2].id,
      readings[0].observed_at,
      readings[2].observed_at,
      readings[0].level_litres,
      refillLitres,
      readings[2].level_litres,
      apparent,
      apparent - 12,
      12,
      refills.map((row) => row.id),
      actorId,
      ago(14),
      `Demo finalized reconciliation ${slug}`,
    ],
  );
  await runner.query(
    `INSERT INTO fuel_reconciliations(tank_id,opening_reading_id,closing_reading_id,period_from,period_to,
     opening_litres,refill_litres,addition_litres,removal_litres,closing_litres,apparent_usage_litres,
     estimated_litres,variance_litres,review_flag,status,created_by)
     VALUES($1,$2,$3,$4,$5,$6,0,0,0,$7,$8,$9,$10,'HIGH_VARIANCE','DRAFT',$11)`,
    [
      tankId,
      readings[3].id,
      readings[4].id,
      readings[3].observed_at,
      readings[4].observed_at,
      readings[3].level_litres,
      readings[4].level_litres,
      30,
      12,
      18,
      actorId,
    ],
  );
}

async function seedMaintenanceAndAlerts(
  runner: ReturnType<typeof AppDataSource.createQueryRunner>,
  orgId: string,
  actorId: string,
  equipmentId: string,
  item: Scenario['equipment'][number],
  slug: string,
  index: number,
) {
  const planId = randomUUID();
  const overdue = index % 2 === 0;
  await runner.query(
    `INSERT INTO maintenance_plans(id,equipment_id,title,description,checklist,trigger_type,interval_days,reference_service_at,reminder_days,created_by)
     VALUES($1,$2,$3,'Demo preventive maintenance','Inspect and test','CALENDAR',30,$4,10,$5)`,
    [
      planId,
      equipmentId,
      `${item.name} preventive service`,
      overdue ? ago(40) : ago(23),
      actorId,
    ],
  );
  await runner.query(
    `INSERT INTO service_records(equipment_id,maintenance_plan_id,performed_at,description,technician,cost,currency,reference,recorded_by)
     VALUES($1,$2,$3,'Completed monthly inspection','Demo Technician',$4,'TZS',$5,$6)`,
    [
      equipmentId,
      planId,
      ago(3 + index),
      item.type === 'GENERATOR' ? 85000 : 35000,
      `DEMO-SVC-${slug}-${index}`,
      actorId,
    ],
  );
  const alertType = item.type === 'GENERATOR' ? 'LOW_FUEL' : 'MONITOR_OFFLINE';
  const ruleId = randomUUID();
  const alertId = randomUUID();
  const severity = index % 2 === 0 ? 'CRITICAL' : 'WARNING';
  const alertStatus =
    index % 3 === 0 ? 'OPEN' : index % 3 === 1 ? 'ACKNOWLEDGED' : 'RESOLVED';
  await runner.query(
    `INSERT INTO alert_rules(id,organization_id,equipment_id,type,severity,threshold,freshness_minutes,created_by)
     VALUES($1,$2,$3,$4,$5,$6,120,$7)`,
    [
      ruleId,
      orgId,
      equipmentId,
      alertType,
      severity,
      alertType === 'LOW_FUEL' ? 100 : null,
      actorId,
    ],
  );
  await runner.query(
    `INSERT INTO alerts(id,organization_id,equipment_id,rule_id,type,severity,message,context,triggered_at,status,
     acknowledged_by,acknowledged_at,resolved_at,resolution_reason,deduplication_key)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      alertId,
      orgId,
      equipmentId,
      ruleId,
      alertType,
      severity,
      `Demo ${alertType.toLowerCase().replaceAll('_', ' ')} alert for ${item.name}`,
      JSON.stringify({ demo: true }),
      ago(2 + index),
      alertStatus,
      alertStatus === 'ACKNOWLEDGED' ? actorId : null,
      alertStatus === 'ACKNOWLEDGED' ? ago(1 + index) : null,
      alertStatus === 'RESOLVED' ? ago(1) : null,
      alertStatus === 'RESOLVED' ? 'Demo issue resolved' : null,
      `demo-${slug}-${index}`,
    ],
  );
  await runner.query(
    `INSERT INTO notifications(user_id,alert_id,title,message,created_at)
     VALUES($1,$2,$3,$4,$5)`,
    [
      actorId,
      alertId,
      `Demo ${severity.toLowerCase()} alert`,
      `${item.name} needs review`,
      ago(2 + index),
    ],
  );
}

async function seedBilling(
  runner: ReturnType<typeof AppDataSource.createQueryRunner>,
  scenario: Scenario,
  orgId: string,
  controllerId: string,
  adminId: string,
  plan: Plan,
  snap: ReturnType<typeof snapshot>,
  files: string[],
) {
  const trialStart = scenario.status === 'TRIALING' ? ago(5) : ago(40);
  const trialEnd = scenario.status === 'TRIALING' ? later(9) : ago(26);
  const paidStart = scenario.status === 'TRIALING' ? null : ago(34);
  const paidEnd =
    scenario.status === 'ACTIVE'
      ? later(scenario.cycle === 'QUARTERLY' ? 56 : 18)
      : scenario.status === 'GRACE'
        ? ago(2)
        : scenario.status === 'EXPIRED'
          ? ago(6)
          : null;
  const graceEnd = scenario.status === 'GRACE' ? later(3) : null;
  await runner.query(
    `INSERT INTO organization_subscriptions(organization_id,plan_id,plan_snapshot,billing_cycle,state,trial_started_at,trial_ends_at,paid_start_at,paid_end_at,grace_ends_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      orgId,
      plan.id,
      JSON.stringify(snap),
      scenario.cycle,
      scenario.status === 'TRIALING'
        ? 'TRIALING'
        : scenario.status === 'ACTIVE'
          ? 'ACTIVE'
          : 'EXPIRED',
      trialStart,
      trialEnd,
      paidStart,
      paidEnd,
      graceEnd,
    ],
  );
  await runner.query(
    `INSERT INTO subscription_periods(organization_id,plan_id,plan_snapshot,billing_cycle,kind,starts_at,ends_at)
     VALUES($1,$2,$3,$4,'TRIAL',$5,$6)`,
    [
      orgId,
      plan.id,
      JSON.stringify(snap),
      scenario.cycle,
      trialStart,
      trialEnd,
    ],
  );
  await runner.query(
    `INSERT INTO audit_logs(actor_user_id,actor_role,organization_id,action,entity_type,entity_id,occurred_at)
     VALUES($1,'Controller',$2,'TRIAL_STARTED','organization',$2,$3)`,
    [controllerId, orgId, trialStart],
  );
  if (scenario.status !== 'TRIALING') {
    const paid = await createInvoice(
      runner,
      scenario,
      orgId,
      controllerId,
      plan,
      snap,
      'PAID',
      ago(29),
      ago(20),
    );
    await createSubmission(
      runner,
      paid.invoiceId,
      orgId,
      controllerId,
      adminId,
      Number(paid.amount),
      plan.currency,
      'APPROVED',
      ago(20),
      files,
      `${scenario.slug}-paid`,
    );
    await runner.query(
      `INSERT INTO subscription_periods(organization_id,order_id,plan_id,plan_snapshot,billing_cycle,kind,starts_at,ends_at,approved_at)
       VALUES($1,$2,$3,$4,$5,'PAID',$6,$7,$8)`,
      [
        orgId,
        paid.orderId,
        plan.id,
        JSON.stringify(snap),
        scenario.cycle,
        paidStart,
        paidEnd,
        ago(20),
      ],
    );
  }
  if (scenario.status === 'TRIALING') {
    await createInvoice(
      runner,
      scenario,
      orgId,
      controllerId,
      plan,
      snap,
      'OPEN',
      ago(5),
      later(9),
    );
  } else if (scenario.status === 'EXPIRED') {
    const renewal = await createInvoice(
      runner,
      scenario,
      orgId,
      controllerId,
      plan,
      snap,
      'OPEN',
      ago(8),
      ago(3),
    );
    await createSubmission(
      runner,
      renewal.invoiceId,
      orgId,
      controllerId,
      adminId,
      Number(renewal.amount),
      plan.currency,
      'REJECTED',
      ago(2),
      files,
      `${scenario.slug}-rejected`,
    );
  } else if (scenario.status === 'GRACE') {
    const renewal = await createInvoice(
      runner,
      scenario,
      orgId,
      controllerId,
      plan,
      snap,
      'OPEN',
      ago(2),
      later(3),
    );
    await createSubmission(
      runner,
      renewal.invoiceId,
      orgId,
      controllerId,
      adminId,
      Number(renewal.amount),
      plan.currency,
      'PENDING_REVIEW',
      ago(1),
      files,
      `${scenario.slug}-pending`,
    );
  } else if (scenario.slug === 'bahari') {
    const renewal = await createInvoice(
      runner,
      scenario,
      orgId,
      controllerId,
      plan,
      snap,
      'OPEN',
      ago(1),
      later(20),
    );
    await createSubmission(
      runner,
      renewal.invoiceId,
      orgId,
      controllerId,
      adminId,
      Number(renewal.amount),
      plan.currency,
      'PENDING_REVIEW',
      ago(0.5),
      files,
      `${scenario.slug}-pending`,
    );
  }
}

async function createInvoice(
  runner: ReturnType<typeof AppDataSource.createQueryRunner>,
  scenario: Scenario,
  orgId: string,
  controllerId: string,
  plan: Plan,
  snap: ReturnType<typeof snapshot>,
  status: 'PAID' | 'OPEN',
  issuedAt: Date,
  dueAt: Date,
) {
  const orderId = randomUUID();
  const invoiceId = randomUUID();
  const amount = price(plan, scenario.cycle);
  const invoiceNumber = `DEMO-${scenario.slug.toUpperCase()}-${status}-${randomBytes(3).toString('hex').toUpperCase()}`;
  await runner.query(
    `INSERT INTO subscription_orders(id,organization_id,plan_id,plan_snapshot,billing_cycle,amount,currency,status,idempotency_key,created_by,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      orderId,
      orgId,
      plan.id,
      JSON.stringify(snap),
      scenario.cycle,
      amount,
      plan.currency,
      status,
      `demo-${randomUUID()}`,
      controllerId,
      issuedAt,
    ],
  );
  await runner.query(
    `INSERT INTO invoices(id,invoice_number,organization_id,order_id,plan_snapshot,billing_cycle,subtotal,total,currency,issued_at,due_at,status,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$11,$12)`,
    [
      invoiceId,
      invoiceNumber,
      orgId,
      orderId,
      JSON.stringify(snap),
      scenario.cycle,
      amount,
      plan.currency,
      issuedAt,
      dueAt,
      status,
      controllerId,
    ],
  );
  await runner.query(
    `INSERT INTO invoice_items(invoice_id,description,quantity,unit_amount,total)
     VALUES($1,$2,1,$3,$3)`,
    [
      invoiceId,
      `${plan.name} ${scenario.cycle.toLowerCase()} demo subscription`,
      amount,
    ],
  );
  return { orderId, invoiceId, amount };
}

async function createSubmission(
  runner: ReturnType<typeof AppDataSource.createQueryRunner>,
  invoiceId: string,
  orgId: string,
  controllerId: string,
  adminId: string,
  claimed: number,
  currency: string,
  status: 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW',
  at: Date,
  files: string[],
  label: string,
) {
  const id = randomUUID();
  const proofId = randomUUID();
  const file = join(proofDir, proofId);
  await writeFile(file, proofBytes, { mode: 0o600, flag: 'wx' });
  files.push(file);
  await runner.query(
    `INSERT INTO payment_submissions(id,organization_id,invoice_id,submitted_by,method,claimed_amount,currency,reference,claimed_paid_at,
     proof_storage_id,proof_original_name,proof_mime,proof_sha256,proof_size,status,reviewed_by,reviewed_at,verified_amount,review_note,created_at)
     VALUES($1,$2,$3,$4,'BANK_TRANSFER',$5,$6,$7,$8,$9,'demo-proof.png','image/png',$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      id,
      orgId,
      invoiceId,
      controllerId,
      claimed,
      currency,
      `DEMO-${label.toUpperCase()}`,
      at,
      proofId,
      createHash('sha256').update(proofBytes).digest('hex'),
      proofBytes.length,
      status,
      status === 'PENDING_REVIEW' ? null : adminId,
      status === 'PENDING_REVIEW' ? null : at,
      status === 'APPROVED' ? claimed : null,
      status === 'REJECTED'
        ? 'Demo reference could not be verified'
        : status === 'APPROVED'
          ? 'Demo approval, no funds transferred'
          : null,
      at,
    ],
  );
  if (status === 'APPROVED')
    await runner.query(
      'INSERT INTO payment_allocations(submission_id,invoice_id,amount,allocated_at) VALUES($1,$2,$3,$4)',
      [id, invoiceId, claimed, at],
    );
  await runner.query(
    `INSERT INTO audit_logs(actor_user_id,actor_role,organization_id,action,entity_type,entity_id,occurred_at)
     VALUES($1,'Controller',$2,'PAYMENT_SUBMITTED','payment_submission',$3,$4)`,
    [controllerId, orgId, id, at],
  );
  if (status !== 'PENDING_REVIEW')
    await runner.query(
      `INSERT INTO audit_logs(actor_user_id,actor_role,organization_id,action,entity_type,entity_id,occurred_at)
     VALUES($1,'Admin',$2,$3,'payment_submission',$4,$5)`,
      [
        adminId,
        orgId,
        status === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_REJECTED',
        id,
        at,
      ],
    );
}

void main().catch((error: Error) => {
  console.error(`Demo seed failed: ${error.message}`);
  process.exitCode = 1;
});
