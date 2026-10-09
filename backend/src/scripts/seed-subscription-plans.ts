import 'dotenv/config';
import { DataSource } from 'typeorm';

export async function seedSubscriptionPlans(db: DataSource) {
  await db.query(`INSERT INTO subscription_plans(code,name,description,monthly_price,quarterly_price,annual_price,currency,site_limit,equipment_limit,controller_limit,features,display_order) VALUES
      ('STARTER','Starter','Live monitoring and basic manual operations',30000,85500,306000,'TZS',1,3,2,'{"live_monitoring":true,"fuel_records":true}'::jsonb,1),
      ('OPERATIONS','Operations','Fuel, maintenance and full operational reports',75000,213750,765000,'TZS',5,15,10,'{"live_monitoring":true,"fuel_records":true,"fuel_estimates":true,"fuel_costs_reconciliation":true,"maintenance":true,"advanced_reports":true,"pdf_export":true}'::jsonb,2),
      ('BUSINESS','Business','Fleet analytics and all implemented operational capabilities',150000,427500,1530000,'TZS',20,50,25,'{"live_monitoring":true,"fuel_records":true,"fuel_estimates":true,"fuel_costs_reconciliation":true,"maintenance":true,"advanced_reports":true,"pdf_export":true,"fleet_analytics":true}'::jsonb,3)
      ON CONFLICT(code) DO NOTHING`);
}
async function main() {
  // Load configuration only for the CLI entry point; tests import the seed function safely.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const source = (require('../../ormconfig') as { default: DataSource })
    .default;
  await source.initialize();
  try {
    await seedSubscriptionPlans(source);
  } finally {
    await source.destroy();
  }
}
if (require.main === module)
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Plan seed failed'}\n`,
    );
    process.exitCode = 1;
  });
