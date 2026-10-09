import 'dotenv/config';
import AppDataSource from '../../ormconfig';

type DemoDevice = {
  id: string;
  current_equipment_id: string;
  device_identifier: string;
};

// Refresh only the monitors created by seed-demo-organizations.ts.
async function main() {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  try {
    await runner.startTransaction();
    const devices = (await runner.query(
      `SELECT d.id, d.current_equipment_id, d.device_identifier
       FROM devices d JOIN organizations o ON o.id = d.organization_id
       WHERE d.device_identifier LIKE 'DEMO-%-MON-%'
         AND d.hardware_model = 'ACTPulse Demo Monitor'
         AND o.name LIKE 'ACTPulse Demo — %'
         AND d.current_equipment_id IS NOT NULL
       ORDER BY d.device_identifier FOR UPDATE OF d`,
    )) as DemoDevice[];
    if (devices.length !== 11)
      throw new Error(`Expected 11 seeded demo monitors, found ${devices.length}; no changes made.`);

    // Existing demo observations are six hours apart. Keep their daily ON/OFF
    // intervals visible while still expiring stale demo readings after a day.
    const at = new Date();
    for (const [index, device] of devices.entries()) {
      const status = index % 2 === 0 ? 'ON' : 'OFF';
      await runner.query(
        `INSERT INTO sensor_logs(device_id,equipment_id,status,recorded_at,received_at,timestamp_basis,source,event_id,kind)
         VALUES($1,$2,$3,$4,$4,'RECEIVED','SIMULATOR',$5,'CONFIRMATION')`,
        [device.id, device.current_equipment_id, status, at, `demo-refresh-${device.id}-${at.getTime()}`],
      );
      await runner.query(
        `UPDATE devices SET offline_timeout_seconds=86400, last_seen_at=$2,
          last_status_at=$2, connected_since_at=COALESCE(connected_since_at,$2),
          connectivity_state='ONLINE', updated_at=$2 WHERE id=$1`,
        [device.id, at],
      );
    }
    await runner.commitTransaction();
    console.log(`Refreshed ${devices.length} demo monitors: 6 ON, 5 OFF at ${at.toISOString()}.`);
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
