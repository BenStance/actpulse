import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MaintenanceService } from './maintenance.service';
import { FuelService } from './fuel.service';

@Injectable()
export class OperationalDashboardService {
  constructor(
    private readonly db: DataSource,
    private readonly maintenance: MaintenanceService,
    private readonly fuel: FuelService,
  ) {}
  private rows<T>(sql: string, args: unknown[] = []): Promise<T[]> {
    return this.db.query(sql, args);
  }
  async snapshot(
    userId: string,
    ids: string[],
    from: Date,
    to: Date,
    timezone = 'UTC',
  ) {
    if (!ids.length)
      return {
        summary: {
          organizations: 0,
          sites: 0,
          purchasedLitres: '0',
          apparentUsageLitres: '0',
          estimatedLitres: '0',
          spendingByCurrency: [],
          maintenanceDue: 0,
          maintenanceOverdue: 0,
          maintenanceDueSoon: 0,
          maintenanceUnable: 0,
          openAlerts: 0,
        },
        upcomingMaintenance: [] as Array<{
          id: string;
          equipmentId: string;
          title: string;
          state: string;
          nextDueAt: Date | null;
        }>,
        byEquipment: [] as Array<{
          equipmentId: string;
          latestFuelReading: null;
          maintenanceStatus: null;
          openAlertCount: number;
          estimate: null;
          apparentUsageLitres: null;
          purchasedLitres: string;
        }>,
        activity: [] as Array<{
          equipment_id: string;
          kind: string;
          at: Date;
          label: string;
        }>,
        fuelSeries: [] as Array<{
          equipment_id: string;
          at: Date;
          level_litres: string;
          source: string;
        }>,
        refillMarkers: [] as Array<{
          equipment_id: string;
          at: Date;
          quantity_litres: string;
        }>,
        costTrend: [] as Array<{
          day: string;
          currency: string;
          amount: string;
          litres: string;
        }>,
      };
    const [
      counts,
      purchases,
      spending,
      apparent,
      latest,
      alerts,
      activity,
      maintenance,
      generators,
      fuelSeries,
      refillMarkers,
      costTrend,
    ] = await Promise.all([
      this.rows<{ organizations: string; sites: string }>(
        `SELECT count(DISTINCT organization_id)::text organizations,count(DISTINCT site_id)::text sites FROM equipment WHERE id=ANY($1::uuid[])`,
        [ids],
      ),
      this.rows<{ litres: string }>(
        `SELECT coalesce(sum(f.quantity_litres),0)::text litres FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.occurred_at>$2 AND f.occurred_at<=$3`,
        [ids, from, to],
      ),
      this.rows<{ currency: string; amount: string; litres: string }>(
        `SELECT currency,sum(total_amount)::text amount,sum(quantity_litres)::text litres FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.currency IS NOT NULL AND f.occurred_at>$2 AND f.occurred_at<=$3 GROUP BY currency ORDER BY currency`,
        [ids, from, to],
      ),
      this.rows<{ litres: string }>(
        `SELECT coalesce(sum(r.apparent_usage_litres),0)::text litres FROM fuel_reconciliations r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND r.status='FINALIZED' AND r.period_from>=$2 AND r.period_to<=$3`,
        [ids, from, to],
      ),
      this.rows<{
        equipment_id: string;
        observed_at: Date;
        level_litres: string;
        source: string;
      }>(
        `SELECT DISTINCT ON (t.generator_id) t.generator_id equipment_id,r.observed_at,r.level_litres,r.source FROM fuel_readings r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND r.voided_at IS NULL ORDER BY t.generator_id,r.observed_at DESC`,
        [ids],
      ),
      this.rows<{ equipment_id: string; total: string }>(
        `SELECT equipment_id,count(*)::text total FROM alerts WHERE equipment_id=ANY($1::uuid[]) AND status <> 'RESOLVED' GROUP BY equipment_id`,
        [ids],
      ),
      this.rows<{
        equipment_id: string;
        kind: string;
        at: Date;
        label: string;
      }>(
        `SELECT * FROM (
        SELECT t.generator_id equipment_id,'FUEL_READING' kind,r.observed_at at,r.source label FROM fuel_readings r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND r.voided_at IS NULL AND r.observed_at>$2 AND r.observed_at<=$3
        UNION ALL SELECT t.generator_id,'REFILL',f.occurred_at,'MANUAL' FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.occurred_at>$2 AND f.occurred_at<=$3
        UNION ALL SELECT s.equipment_id,'SERVICE',s.performed_at,'MANUAL' FROM service_records s WHERE s.equipment_id=ANY($1::uuid[]) AND s.voided_at IS NULL AND s.performed_at>$2 AND s.performed_at<=$3
        UNION ALL SELECT a.equipment_id,'ALERT',a.triggered_at,a.status FROM alerts a WHERE a.equipment_id=ANY($1::uuid[]) AND a.triggered_at>$2 AND a.triggered_at<=$3
      ) activity ORDER BY at DESC LIMIT 25`,
        [ids, from, to],
      ),
      this.maintenance.list({ sub: userId, role: 'Admin' }, { pageSize: 1 }),
      this.rows<{ id: string }>(
        "SELECT id FROM equipment WHERE id=ANY($1::uuid[]) AND type='GENERATOR'",
        [ids],
      ),
      this.rows<{
        equipment_id: string;
        at: Date;
        level_litres: string;
        source: string;
      }>(
        `SELECT t.generator_id equipment_id,r.observed_at at,r.level_litres,r.source FROM fuel_readings r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND r.voided_at IS NULL AND r.observed_at>$2 AND r.observed_at<=$3 ORDER BY r.observed_at DESC LIMIT 200`,
        [ids, from, to],
      ),
      this.rows<{ equipment_id: string; at: Date; quantity_litres: string }>(
        `SELECT t.generator_id equipment_id,f.occurred_at at,f.quantity_litres FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.occurred_at>$2 AND f.occurred_at<=$3 ORDER BY f.occurred_at DESC LIMIT 200`,
        [ids, from, to],
      ),
      this.rows<{
        day: string;
        currency: string;
        amount: string;
        litres: string;
      }>(
        `SELECT (f.occurred_at AT TIME ZONE $4)::date::text AS "day",f.currency,sum(f.total_amount)::text AS amount,sum(f.quantity_litres)::text AS litres FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.currency IS NOT NULL AND f.occurred_at>$2 AND f.occurred_at<=$3 GROUP BY 1,f.currency ORDER BY 1,f.currency LIMIT 200`,
        [ids, from, to, timezone],
      ),
    ]);
    const estimates = await Promise.all(
      generators.map(async (row) => ({
        id: row.id,
        value: await this.fuel.estimate(
          { sub: userId, role: 'Admin' },
          row.id,
          from,
          to,
        ),
      })),
    );
    const estimatedLitres = estimates.reduce(
      (total, row) => total + Number(row.value.estimatedLitres),
      0,
    );
    const [apparentRows, purchaseRows] = await Promise.all([
      this.rows<{ equipment_id: string; litres: string }>(
        `SELECT t.generator_id equipment_id,sum(r.apparent_usage_litres)::text litres FROM fuel_reconciliations r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND r.status='FINALIZED' AND r.period_from>=$2 AND r.period_to<=$3 GROUP BY t.generator_id`,
        [ids, from, to],
      ),
      this.rows<{ equipment_id: string; litres: string }>(
        `SELECT t.generator_id equipment_id,sum(f.quantity_litres)::text litres FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.occurred_at>$2 AND f.occurred_at<=$3 GROUP BY t.generator_id`,
        [ids, from, to],
      ),
    ]);
    const apparentMap = new Map(
      apparentRows.map((row) => [row.equipment_id, row.litres]),
    );
    const purchaseMap = new Map(
      purchaseRows.map((row) => [row.equipment_id, row.litres]),
    );
    const latestMap = new Map(latest.map((row) => [row.equipment_id, row]));
    const alertMap = new Map(
      alerts.map((row) => [row.equipment_id, Number(row.total)]),
    );
    const scopedPlans = maintenance.plans.filter((plan) =>
      ids.includes(plan.equipment_id),
    );
    const maintenanceMap = new Map<string, string>();
    for (const plan of scopedPlans) {
      const current = maintenanceMap.get(plan.equipment_id);
      if (
        !current ||
        ['OVERDUE', 'DUE', 'DUE_SOON'].indexOf(plan.status.state) <
          ['OVERDUE', 'DUE', 'DUE_SOON'].indexOf(current)
      )
        maintenanceMap.set(plan.equipment_id, plan.status.state);
    }
    return {
      summary: {
        organizations: Number(counts[0]?.organizations || 0),
        sites: Number(counts[0]?.sites || 0),
        purchasedLitres: purchases[0]?.litres || '0',
        apparentUsageLitres: apparent[0]?.litres || '0',
        estimatedLitres: estimatedLitres.toFixed(3),
        spendingByCurrency: spending,
        maintenanceDue: scopedPlans.filter((p) => p.status.state === 'DUE')
          .length,
        maintenanceOverdue: scopedPlans.filter(
          (p) => p.status.state === 'OVERDUE',
        ).length,
        maintenanceDueSoon: scopedPlans.filter(
          (p) => p.status.state === 'DUE_SOON',
        ).length,
        maintenanceUnable: scopedPlans.filter(
          (p) => p.status.state === 'UNABLE_TO_DETERMINE',
        ).length,
        openAlerts: alerts.reduce((sum, row) => sum + Number(row.total), 0),
      },
      upcomingMaintenance: scopedPlans
        .filter((p) => ['DUE_SOON', 'DUE', 'OVERDUE'].includes(p.status.state))
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          equipmentId: p.equipment_id,
          title: p.title,
          state: p.status.state,
          nextDueAt: p.status.nextDueAt,
        })),
      byEquipment: ids.map((id) => ({
        equipmentId: id,
        latestFuelReading: latestMap.get(id) || null,
        maintenanceStatus: maintenanceMap.get(id) || null,
        openAlertCount: alertMap.get(id) || 0,
        estimate: estimates.find((row) => row.id === id)?.value || null,
        apparentUsageLitres: apparentMap.get(id) || null,
        purchasedLitres: purchaseMap.get(id) || '0',
      })),
      activity,
      fuelSeries,
      refillMarkers,
      costTrend,
    };
  }
}
