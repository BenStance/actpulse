import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditTrailService } from '../billing/audit-trail.service';
import {
  EquipmentType,
  MonitoringDefinition,
} from '../equipment/equipment.entity';
import {
  EquipmentAccessService,
  MonitoringService,
} from '../monitoring/monitoring.service';
import {
  Actor,
  currency,
  decimal,
  instant,
  optionalText,
  pageParams,
  requiredText,
} from './operations.util';

type Tank = {
  id: string;
  generator_id: string;
  capacity_litres: string;
  organization_id: string;
  name: string;
};

@Injectable()
export class FuelService {
  constructor(
    private readonly db: DataSource,
    private readonly access: EquipmentAccessService,
    private readonly monitoring: MonitoringService,
    private readonly auditTrail: AuditTrailService,
  ) {}

  private async rows<T>(sql: string, args: unknown[] = []): Promise<T[]> {
    const result: unknown = await this.db.query(sql, args);
    return (
      /^\s*UPDATE/i.test(sql) &&
      Array.isArray(result) &&
      Array.isArray(result[0])
        ? result[0]
        : result
    ) as T[];
  }

  private async generator(actor: Actor, equipmentId: string) {
    const equipment = await this.access.one(actor.sub, equipmentId);
    if (equipment.type !== EquipmentType.GENERATOR)
      throw new BadRequestException('Fuel records require a generator');
    return equipment;
  }

  private async tank(actor: Actor, equipmentId: string): Promise<Tank> {
    await this.generator(actor, equipmentId);
    const tank = (
      await this.rows<Tank>(
        'SELECT * FROM fuel_tanks WHERE generator_id=$1 AND is_active=true',
        [equipmentId],
      )
    )[0];
    if (!tank)
      throw new BadRequestException('Configure a dedicated fuel tank first');
    return tank;
  }

  async configureTank(
    actor: Actor,
    equipmentId: string,
    body: Record<string, unknown>,
  ) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const equipment = await this.generator(actor, equipmentId);
    const capacity = decimal(body.capacityLitres, 'Tank capacity', 3, true);
    const name = optionalText(body.name, 160) || 'Dedicated tank';
    const latest = (
      await this.rows<{ level_litres: string }>(
        'SELECT level_litres FROM fuel_readings r JOIN fuel_tanks t ON t.id=r.tank_id WHERE t.generator_id=$1 AND r.voided_at IS NULL ORDER BY observed_at DESC LIMIT 1',
        [equipmentId],
      )
    )[0];
    if (latest && Number(latest.level_litres) > Number(capacity))
      throw new BadRequestException(
        'Capacity is below the latest valid reading',
      );
    const [tank] = await this.rows<Tank>(
      `INSERT INTO fuel_tanks (organization_id,generator_id,name,capacity_litres)
      VALUES ($1,$2,$3,$4) ON CONFLICT (generator_id) DO UPDATE SET name=EXCLUDED.name,
      capacity_litres=EXCLUDED.capacity_litres,updated_at=now() RETURNING *`,
      [equipment.organizationId, equipmentId, name, capacity],
    );
    await this.db.query(
      'UPDATE equipment SET tank_capacity_litres=$1 WHERE id=$2',
      [capacity, equipmentId],
    );
    await this.audit(
      actor,
      'fuel_tank',
      tank.id,
      'CONFIGURE',
      requiredText(body.reason ?? 'Tank configuration', 'Reason', 500),
      null,
      tank,
    );
    return tank;
  }

  async overview(
    actor: Actor,
    equipmentId: string,
    query: Record<string, unknown>,
  ) {
    const equipment = await this.generator(actor, equipmentId);
    const tank =
      (
        await this.rows<Tank>(
          'SELECT * FROM fuel_tanks WHERE generator_id=$1',
          [equipmentId],
        )
      )[0] ?? null;
    if (!tank)
      return {
        equipment: { id: equipment.id, name: equipment.name },
        tank: null,
        message: 'No dedicated fuel tank configured',
      };
    const period = this.monitoring.resolvePeriod(
      {
        preset: typeof query.preset === 'string' ? query.preset : '',
        from: query.from as string | undefined,
        to: query.to as string | undefined,
        timezone: query.timezone as string | undefined,
      },
      equipment.site.timezone,
    );
    const { take, skip, page, pageSize } = pageParams(
      query.page,
      query.pageSize,
    );
    const [
      readingRows,
      refillRows,
      adjustmentRows,
      reconciliations,
      rates,
      latest,
      totals,
      countRows,
      estimate,
    ] = await Promise.all([
      this.rows(
        'SELECT id,observed_at,received_at,level_litres,source,method,notes,recorded_by,voided_at FROM fuel_readings WHERE tank_id=$1 AND observed_at BETWEEN $2 AND $3 ORDER BY observed_at DESC,id DESC LIMIT $4 OFFSET $5',
        [tank.id, period.from, period.to, take, skip],
      ),
      this.rows(
        'SELECT id,occurred_at,quantity_litres,supplier,reference,notes,currency,unit_price,fuel_amount,additional_cost,total_amount,recorded_by,voided_at FROM fuel_refills WHERE tank_id=$1 AND occurred_at BETWEEN $2 AND $3 ORDER BY occurred_at DESC,id DESC LIMIT $4 OFFSET $5',
        [tank.id, period.from, period.to, take, skip],
      ),
      this.rows(
        'SELECT id,occurred_at,direction,quantity_litres,reason,notes,reference,recorded_by,voided_at FROM fuel_adjustments WHERE tank_id=$1 AND occurred_at BETWEEN $2 AND $3 ORDER BY occurred_at DESC,id DESC LIMIT $4 OFFSET $5',
        [tank.id, period.from, period.to, take, skip],
      ),
      this.rows(
        'SELECT * FROM fuel_reconciliations WHERE tank_id=$1 AND period_to>$2 AND period_from<$3 ORDER BY period_to DESC LIMIT $4 OFFSET $5',
        [tank.id, period.from, period.to, take, skip],
      ),
      this.rows(
        'SELECT * FROM fuel_estimates WHERE generator_id=$1 ORDER BY effective_from DESC',
        [equipmentId],
      ),
      this.rows(
        'SELECT observed_at,level_litres,source,method FROM fuel_readings WHERE tank_id=$1 AND voided_at IS NULL ORDER BY observed_at DESC,id DESC LIMIT 1',
        [tank.id],
      ),
      this.rows<{
        purchased_litres: string;
        spending: Array<{ currency: string; total: string }>;
      }>(
        `SELECT coalesce(sum(quantity_litres),0)::text purchased_litres,
        coalesce(json_agg(json_build_object('currency',currency,'total',total)) FILTER (WHERE currency IS NOT NULL),'[]'::json) spending
        FROM (SELECT quantity_litres,currency,total_amount AS total FROM fuel_refills
          WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at>$2 AND occurred_at<=$3) f`,
        [tank.id, period.from, period.to],
      ),
      this.rows<{ readings: string; refills: string; adjustments: string }>(
        `SELECT
        (SELECT count(*) FROM fuel_readings WHERE tank_id=$1 AND observed_at BETWEEN $2 AND $3)::text readings,
        (SELECT count(*) FROM fuel_refills WHERE tank_id=$1 AND occurred_at BETWEEN $2 AND $3)::text refills,
        (SELECT count(*) FROM fuel_adjustments WHERE tank_id=$1 AND occurred_at BETWEEN $2 AND $3)::text adjustments`,
        [tank.id, period.from, period.to],
      ),
      this.estimate(actor, equipmentId, period.from, period.to),
    ]);
    const spending = await this.rows<{
      currency: string;
      amount: string;
      litres: string;
    }>(
      `SELECT currency,sum(total_amount)::text amount,sum(quantity_litres)::text litres
      FROM fuel_refills WHERE tank_id=$1 AND voided_at IS NULL AND currency IS NOT NULL AND occurred_at>$2 AND occurred_at<=$3 GROUP BY currency ORDER BY currency`,
      [tank.id, period.from, period.to],
    );
    return {
      equipment: {
        id: equipment.id,
        name: equipment.name,
        monitoringDefinition: equipment.monitoringDefinition,
      },
      tank,
      period,
      latestReading: latest[0] ?? null,
      readings: readingRows,
      refills: refillRows,
      adjustments: adjustmentRows,
      reconciliations,
      rates,
      estimate,
      totals: {
        purchasedLitres: totals[0]?.purchased_litres ?? '0',
        spendingByCurrency: spending,
      },
      counts: countRows[0],
      page,
      pageSize,
      sourceNotes:
        'Readings are recorded observations. Refills are purchases, not measurements. Estimates use observed eligible hours only.',
    };
  }

  async addReading(
    actor: Actor,
    equipmentId: string,
    body: Record<string, unknown>,
  ) {
    const tank = await this.tank(actor, equipmentId);
    const level = decimal(body.levelLitres, 'Fuel level');
    if (Number(level) > Number(tank.capacity_litres))
      throw new BadRequestException('Fuel level exceeds tank capacity');
    const observed = instant(body.observedAt, 'Reading time');
    const [row] = await this.rows(
      `INSERT INTO fuel_readings (tank_id,observed_at,level_litres,source,method,notes,recorded_by)
      VALUES ($1,$2,$3,'MANUAL',$4,$5,$6) RETURNING *`,
      [
        tank.id,
        observed,
        level,
        optionalText(body.method, 80),
        optionalText(body.notes),
        actor.sub,
      ],
    );
    await this.audit(
      actor,
      'fuel_reading',
      (row as { id: string }).id,
      'CREATE',
      null,
      null,
      row,
    );
    return row;
  }

  async addRefill(
    actor: Actor,
    equipmentId: string,
    body: Record<string, unknown>,
  ) {
    const tank = await this.tank(actor, equipmentId);
    const quantity = decimal(body.quantityLitres, 'Refill quantity', 3, true);
    const occurred = instant(body.occurredAt, 'Refill time');
    let cost: {
      currency: string;
      unitPrice: string;
      additional: string;
    } | null = null;
    if (body.unitPrice !== undefined && body.unitPrice !== '')
      cost = {
        currency: currency(body.currency ?? 'TZS'),
        unitPrice: decimal(body.unitPrice, 'Unit price', 4),
        additional: decimal(body.additionalCost ?? '0', 'Additional cost', 4),
      };
    if (body.currency && !cost)
      throw new BadRequestException(
        'Unit price is required when currency is provided',
      );
    const before = body.beforeReadingId
      ? await this.reading(
          tank.id,
          typeof body.beforeReadingId === 'string' ? body.beforeReadingId : '',
        )
      : null;
    const after = body.afterReadingId
      ? await this.reading(
          tank.id,
          typeof body.afterReadingId === 'string' ? body.afterReadingId : '',
        )
      : null;
    if (
      before &&
      after &&
      (new Date(before.observed_at) > occurred ||
        new Date(after.observed_at) < occurred)
    )
      throw new BadRequestException(
        'Before and after readings must bracket the refill',
      );
    if (
      before &&
      after &&
      Number(after.level_litres) >
        Number(before.level_litres) + Number(quantity) + 0.001
    )
      throw new BadRequestException(
        'After reading exceeds before reading plus refill quantity',
      );
    const [row] = await this.rows(
      `INSERT INTO fuel_refills (tank_id,occurred_at,quantity_litres,before_reading_id,after_reading_id,supplier,reference,notes,currency,unit_price,fuel_amount,additional_cost,total_amount,recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CASE WHEN $10::numeric IS NULL THEN NULL ELSE round($3::numeric*$10::numeric,4) END,$11,
      CASE WHEN $10::numeric IS NULL THEN NULL ELSE round($3::numeric*$10::numeric+$11::numeric,4) END,$12) RETURNING *`,
      [
        tank.id,
        occurred,
        quantity,
        before?.id ?? null,
        after?.id ?? null,
        optionalText(body.supplier, 160),
        optionalText(body.reference, 160),
        optionalText(body.notes),
        cost?.currency ?? null,
        cost?.unitPrice ?? null,
        cost?.additional ?? null,
        actor.sub,
      ],
    );
    await this.audit(
      actor,
      'fuel_refill',
      (row as { id: string }).id,
      'CREATE',
      null,
      null,
      row,
    );
    return {
      ...(row as object),
      balanceWarning:
        before && !after
          ? 'No after reading; tank balance is not measured'
          : null,
    };
  }

  async addAdjustment(
    actor: Actor,
    equipmentId: string,
    body: Record<string, unknown>,
  ) {
    const tank = await this.tank(actor, equipmentId);
    if (body.direction !== 'ADDITION' && body.direction !== 'REMOVAL')
      throw new BadRequestException('Direction must be ADDITION or REMOVAL');
    const [row] = await this.rows(
      `INSERT INTO fuel_adjustments (tank_id,occurred_at,direction,quantity_litres,reason,notes,reference,recorded_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        tank.id,
        instant(body.occurredAt, 'Adjustment time'),
        body.direction,
        decimal(body.quantityLitres, 'Adjustment quantity', 3, true),
        requiredText(body.reason, 'Reason', 160),
        optionalText(body.notes),
        optionalText(body.reference, 160),
        actor.sub,
      ],
    );
    await this.audit(
      actor,
      'fuel_adjustment',
      (row as { id: string }).id,
      'CREATE',
      String(body.reason),
      null,
      row,
    );
    return row;
  }

  async addRate(
    actor: Actor,
    equipmentId: string,
    body: Record<string, unknown>,
  ) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    await this.tank(actor, equipmentId);
    const from = instant(body.effectiveFrom, 'Effective from');
    const to = body.effectiveTo
      ? instant(body.effectiveTo, 'Effective to')
      : null;
    if (to && to <= from)
      throw new BadRequestException('Effective end must follow start');
    const overlap = await this.rows(
      `SELECT id FROM fuel_estimates WHERE generator_id=$1 AND effective_from<coalesce($3::timestamptz,'infinity') AND coalesce(effective_to,'infinity')>$2`,
      [equipmentId, from, to],
    );
    if (overlap.length)
      throw new BadRequestException('Estimate rate periods cannot overlap');
    const [row] = await this.rows(
      `INSERT INTO fuel_estimates (generator_id,estimated_litres_per_hour,effective_from,effective_to,basis,created_by)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        equipmentId,
        decimal(body.litresPerHour, 'Estimated litres per hour', 4, true),
        from,
        to,
        requiredText(body.basis, 'Estimate basis'),
        actor.sub,
      ],
    );
    await this.audit(
      actor,
      'fuel_estimate',
      (row as { id: string }).id,
      'CREATE',
      null,
      null,
      row,
    );
    return row;
  }

  async estimate(actor: Actor, equipmentId: string, from: Date, to: Date) {
    const equipment = await this.generator(actor, equipmentId);
    const rates = await this.rows<{
      estimated_litres_per_hour: string;
      effective_from: Date;
      effective_to: Date | null;
      basis: string;
    }>(
      `SELECT * FROM fuel_estimates WHERE generator_id=$1 AND effective_from<$3 AND coalesce(effective_to,'infinity')>$2 ORDER BY effective_from`,
      [equipmentId, from, to],
    );
    let estimatedMilliLitres = 0n,
      eligibleMs = 0,
      unknownMs = 0,
      coveredMs = 0;
    const intervals: Array<{
      from: Date;
      to: Date;
      basis: string;
      litresPerHour: string;
      observedOnMs: number;
      unknownMs: number;
      estimatedLitres: string;
    }> = [];
    for (const rate of rates) {
      const start = new Date(
        Math.max(from.getTime(), new Date(rate.effective_from).getTime()),
      );
      const end = new Date(
        Math.min(
          to.getTime(),
          rate.effective_to
            ? new Date(rate.effective_to).getTime()
            : to.getTime(),
        ),
      );
      if (start >= end) continue;
      const metrics = await this.monitoring.metrics(
        equipment,
        start,
        end,
        equipment.site.timezone,
      );
      const [whole, fraction = ''] = rate.estimated_litres_per_hour.split('.');
      const scaledRate =
        BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
      const milliLitres = (BigInt(metrics.onMs) * scaledRate) / 3600000n / 10n;
      estimatedMilliLitres += milliLitres;
      eligibleMs += metrics.eligibleMs;
      unknownMs += metrics.unknownMs;
      coveredMs += end.getTime() - start.getTime();
      intervals.push({
        from: start,
        to: end,
        basis: rate.basis,
        litresPerHour: rate.estimated_litres_per_hour,
        observedOnMs: metrics.onMs,
        unknownMs: metrics.unknownMs,
        estimatedLitres: `${milliLitres / 1000n}.${String(milliLitres % 1000n).padStart(3, '0')}`,
      });
    }
    return {
      estimatedLitres: `${estimatedMilliLitres / 1000n}.${String(estimatedMilliLitres % 1000n).padStart(3, '0')}`,
      eligibleMs,
      unknownMs,
      configuredMs: coveredMs,
      periodMs: to.getTime() - from.getTime(),
      coverage: coveredMs ? (eligibleMs - unknownMs) / coveredMs : null,
      unobservedMs: Math.max(0, coveredMs - eligibleMs + unknownMs),
      definition: equipment.monitoringDefinition,
      limitation:
        equipment.monitoringDefinition ===
        MonitoringDefinition.OUTPUT_POWER_PRESENT
          ? 'Estimate uses output-powered hours, not confirmed engine-running hours'
          : 'Fixed rate estimate from observed engine-running hours; not measured fuel use',
      intervals,
    };
  }

  private async reading(tankId: string, id: string) {
    const [row] = await this.rows<{
      id: string;
      tank_id: string;
      observed_at: Date;
      level_litres: string;
      voided_at: Date | null;
      source: string;
    }>('SELECT * FROM fuel_readings WHERE id=$1 AND tank_id=$2', [id, tankId]);
    if (!row || row.voided_at)
      throw new BadRequestException('Valid tank reading required');
    return row;
  }

  async reconcile(
    actor: Actor,
    equipmentId: string,
    body: Record<string, unknown>,
  ) {
    const tank = await this.tank(actor, equipmentId);
    const opening = await this.reading(tank.id, String(body.openingReadingId));
    const closing = await this.reading(tank.id, String(body.closingReadingId));
    if (
      opening.id === closing.id ||
      new Date(opening.observed_at) >= new Date(closing.observed_at)
    )
      throw new BadRequestException(
        'Closing reading must follow opening reading',
      );
    const from = new Date(opening.observed_at),
      to = new Date(closing.observed_at);
    if (to.getTime() - from.getTime() > 366 * 86400000)
      throw new BadRequestException('Reconciliation is limited to 366 days');
    const overlap = await this.rows(
      `SELECT id FROM fuel_reconciliations WHERE tank_id=$1 AND status='FINALIZED' AND period_from<$3 AND period_to>$2`,
      [tank.id, from, to],
    );
    if (overlap.length)
      throw new BadRequestException(
        'This period overlaps a finalized reconciliation',
      );
    const boundary = await this.rows(
      `SELECT id FROM fuel_refills WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at IN ($2,$3)
      UNION ALL SELECT id FROM fuel_adjustments WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at IN ($2,$3)`,
      [tank.id, from, to],
    );
    if (boundary.length)
      throw new BadRequestException(
        'Resolve movements at the opening or closing reading timestamp before reconciling',
      );
    const [calc] = await this.rows<{
      refill_litres: string;
      addition_litres: string;
      removal_litres: string;
      refill_ids: string[];
      adjustment_ids: string[];
      apparent_usage_litres: string;
    }>(
      `WITH f AS (SELECT coalesce(sum(quantity_litres),0) litres,coalesce(array_agg(id),'{}'::uuid[]) ids FROM fuel_refills WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at>$2 AND occurred_at<$3),
      a AS (SELECT coalesce(sum(quantity_litres) FILTER (WHERE direction='ADDITION'),0) additions,coalesce(sum(quantity_litres) FILTER (WHERE direction='REMOVAL'),0) removals,coalesce(array_agg(id),'{}'::uuid[]) ids FROM fuel_adjustments WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at>$2 AND occurred_at<$3)
      SELECT f.litres::text refill_litres,a.additions::text addition_litres,a.removals::text removal_litres,f.ids refill_ids,a.ids adjustment_ids,
      ($4::numeric+f.litres+a.additions-a.removals-$5::numeric)::text apparent_usage_litres FROM f CROSS JOIN a`,
      [tank.id, from, to, opening.level_litres, closing.level_litres],
    );
    const estimate = await this.estimate(actor, equipmentId, from, to);
    const flag =
      Number(calc.apparent_usage_litres) < 0
        ? 'NEGATIVE_USAGE'
        : Number(calc.apparent_usage_litres) > Number(tank.capacity_litres) * 5
          ? 'REVIEW_HIGH_USAGE'
          : null;
    const [row] = await this.rows(
      `INSERT INTO fuel_reconciliations (tank_id,opening_reading_id,closing_reading_id,period_from,period_to,opening_litres,refill_litres,addition_litres,removal_litres,closing_litres,apparent_usage_litres,estimated_litres,variance_litres,review_flag,included_refill_ids,included_adjustment_ids,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$11::numeric-$12::numeric,$13,$14,$15,$16) RETURNING *`,
      [
        tank.id,
        opening.id,
        closing.id,
        from,
        to,
        opening.level_litres,
        calc.refill_litres,
        calc.addition_litres,
        calc.removal_litres,
        closing.level_litres,
        calc.apparent_usage_litres,
        estimate.intervals.length ? estimate.estimatedLitres : null,
        flag,
        calc.refill_ids,
        calc.adjustment_ids,
        actor.sub,
      ],
    );
    await this.audit(
      actor,
      'fuel_reconciliation',
      (row as { id: string }).id,
      'DRAFT',
      null,
      null,
      row,
    );
    return row;
  }

  async finalize(actor: Actor, id: string, note: unknown) {
    if (actor.role !== 'Admin') throw new ForbiddenException();
    const [existing] = await this.rows<{
      id: string;
      tank_id: string;
      status: string;
      review_flag: string | null;
      opening_reading_id: string;
      closing_reading_id: string;
      period_from: Date;
      period_to: Date;
      opening_litres: string;
      closing_litres: string;
      refill_litres: string;
      addition_litres: string;
      removal_litres: string;
      included_refill_ids: string[];
      included_adjustment_ids: string[];
    }>(
      `SELECT r.* FROM fuel_reconciliations r JOIN fuel_tanks t ON t.id=r.tank_id WHERE r.id=$1`,
      [id],
    );
    if (!existing) throw new NotFoundException('Reconciliation not found');
    const tank = (
      await this.rows<Tank>('SELECT * FROM fuel_tanks WHERE id=$1', [
        existing.tank_id,
      ])
    )[0];
    await this.tank(actor, tank.generator_id);
    if (existing.status !== 'DRAFT')
      throw new BadRequestException('Reconciliation is already finalized');
    const [source] = await this.rows<{
      opening: string | null;
      closing: string | null;
      refill_litres: string;
      addition_litres: string;
      removal_litres: string;
      refill_ids: string[];
      adjustment_ids: string[];
    }>(
      `SELECT
      (SELECT level_litres::text FROM fuel_readings WHERE id=$4 AND tank_id=$1 AND voided_at IS NULL) opening,
      (SELECT level_litres::text FROM fuel_readings WHERE id=$5 AND tank_id=$1 AND voided_at IS NULL) closing,
      (SELECT coalesce(sum(quantity_litres),0)::text FROM fuel_refills WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at>$2 AND occurred_at<$3) refill_litres,
      (SELECT coalesce(sum(quantity_litres),0)::text FROM fuel_adjustments WHERE tank_id=$1 AND voided_at IS NULL AND direction='ADDITION' AND occurred_at>$2 AND occurred_at<$3) addition_litres,
      (SELECT coalesce(sum(quantity_litres),0)::text FROM fuel_adjustments WHERE tank_id=$1 AND voided_at IS NULL AND direction='REMOVAL' AND occurred_at>$2 AND occurred_at<$3) removal_litres,
      (SELECT coalesce(array_agg(id),'{}'::uuid[]) FROM fuel_refills WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at>$2 AND occurred_at<$3) refill_ids,
      (SELECT coalesce(array_agg(id),'{}'::uuid[]) FROM fuel_adjustments WHERE tank_id=$1 AND voided_at IS NULL AND occurred_at>$2 AND occurred_at<$3) adjustment_ids`,
      [
        existing.tank_id,
        existing.period_from,
        existing.period_to,
        existing.opening_reading_id,
        existing.closing_reading_id,
      ],
    );
    const sameNumber = (a: string | null, b: string) =>
      a !== null && Number(a) === Number(b);
    const sameIds = (a: string[], b: string[]) =>
      JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    if (
      !sameNumber(source.opening, existing.opening_litres) ||
      !sameNumber(source.closing, existing.closing_litres) ||
      !sameNumber(source.refill_litres, existing.refill_litres) ||
      !sameNumber(source.addition_litres, existing.addition_litres) ||
      !sameNumber(source.removal_litres, existing.removal_litres) ||
      !sameIds(source.refill_ids, existing.included_refill_ids) ||
      !sameIds(source.adjustment_ids, existing.included_adjustment_ids)
    )
      throw new BadRequestException(
        'Draft inputs changed; create a new reconciliation draft before finalizing',
      );
    if (
      (
        await this.rows(
          `SELECT id FROM fuel_reconciliations WHERE id<>$1 AND tank_id=$2 AND status='FINALIZED' AND period_from<$4 AND period_to>$3`,
          [id, existing.tank_id, existing.period_from, existing.period_to],
        )
      ).length
    )
      throw new BadRequestException(
        'Period overlaps a finalized reconciliation',
      );
    const reason = requiredText(note, 'Finalization review note', 1000);
    const row = await this.db.transaction(async (manager) => {
      const updatedResult: unknown = await manager.query(
        `UPDATE fuel_reconciliations SET status='FINALIZED',finalized_by=$2,finalized_at=now(),finalization_note=$3 WHERE id=$1 AND status='DRAFT' RETURNING *`,
        [id, actor.sub, reason],
      );
      const [updated] = (
        Array.isArray(updatedResult) && Array.isArray(updatedResult[0])
          ? updatedResult[0]
          : updatedResult
      ) as Record<string, unknown>[];
      if (!updated)
        throw new BadRequestException(
          'Reconciliation was finalized by another request',
        );
      await manager.query(
        'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.sub,
          'fuel_reconciliation',
          id,
          'FINALIZE',
          reason,
          JSON.stringify(existing),
          JSON.stringify(updated),
        ],
      );
      await this.auditTrail.record(
        {
          actorId: actor.sub,
          actorRole: actor.role,
          organizationId: tank.organization_id,
          action: 'RECONCILIATION_FINALIZED',
          entityType: 'fuel_reconciliation',
          entityId: id,
          after: { status: 'FINALIZED' },
          reason,
        },
        manager,
      );
      return updated;
    });
    return row;
  }

  async voidRecord(
    actor: Actor,
    kind: 'readings' | 'refills' | 'adjustments',
    id: string,
    reason: unknown,
  ) {
    const table = {
      readings: 'fuel_readings',
      refills: 'fuel_refills',
      adjustments: 'fuel_adjustments',
    }[kind];
    if (!table) throw new BadRequestException('Invalid record type');
    const [row] = await this.rows<{
      id: string;
      tank_id: string;
      recorded_by: string | null;
      source?: string;
      observed_at?: Date;
      occurred_at?: Date;
      voided_at: Date | null;
    }>(`SELECT * FROM ${table} WHERE id=$1`, [id]);
    if (!row) throw new NotFoundException('Record not found');
    const tank = (
      await this.rows<Tank>('SELECT * FROM fuel_tanks WHERE id=$1', [
        row.tank_id,
      ])
    )[0];
    await this.tank(actor, tank.generator_id);
    if (actor.role !== 'Admin' && row.recorded_by !== actor.sub)
      throw new ForbiddenException('Only your own records can be corrected');
    if (row.source === 'SENSOR')
      throw new BadRequestException(
        'Sensor readings cannot be manually corrected',
      );
    const at = row.observed_at ?? row.occurred_at;
    if (
      (
        await this.rows(
          `SELECT id FROM fuel_reconciliations WHERE tank_id=$1 AND status='FINALIZED' AND period_from<=$2 AND period_to>=$2`,
          [tank.id, at],
        )
      ).length
    )
      throw new BadRequestException(
        'Record is frozen by a finalized reconciliation',
      );
    if (row.voided_at)
      throw new BadRequestException('Record is already voided');
    const why = requiredText(reason, 'Correction reason', 1000);
    const updated = await this.db.transaction(async (manager) => {
      const result: unknown = await manager.query(
        `UPDATE ${table} SET voided_at=now(),voided_by=$2,void_reason=$3 WHERE id=$1 AND voided_at IS NULL RETURNING *`,
        [id, actor.sub, why],
      );
      const [record] = (
        Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result
      ) as Record<string, unknown>[];
      if (!record) throw new BadRequestException('Record is already voided');
      await manager.query(
        'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.sub,
          table,
          id,
          'VOID',
          why,
          JSON.stringify(row),
          JSON.stringify(record),
        ],
      );
      await this.auditTrail.record(
        {
          actorId: actor.sub,
          actorRole: actor.role,
          organizationId: tank.organization_id,
          action: 'FUEL_RECORD_VOIDED',
          entityType: table,
          entityId: id,
          after: { status: 'VOID' },
          reason: why,
        },
        manager,
      );
      return record;
    });
    return { record: updated, equipmentId: tank.generator_id };
  }

  async correctRecord(
    actor: Actor,
    kind: 'readings' | 'refills' | 'adjustments',
    id: string,
    body: Record<string, unknown>,
  ) {
    const table = {
      readings: 'fuel_readings',
      refills: 'fuel_refills',
      adjustments: 'fuel_adjustments',
    }[kind];
    if (!table) throw new BadRequestException('Invalid record type');
    const why = requiredText(body.correctionReason, 'Correction reason', 1000);
    const [old] = await this.rows<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE id=$1`,
      [id],
    );
    if (!old) throw new NotFoundException('Record not found');
    const [tank] = await this.rows<Tank>(
      'SELECT * FROM fuel_tanks WHERE id=$1',
      [old.tank_id],
    );
    if (!tank) throw new NotFoundException('Tank not found');
    await this.tank(actor, tank.generator_id);
    if (actor.role !== 'Admin' && old.recorded_by !== actor.sub)
      throw new ForbiddenException('Only your own records can be corrected');
    if (old.source === 'SENSOR')
      throw new BadRequestException(
        'Sensor readings cannot be manually corrected',
      );
    if (old.voided_at)
      throw new BadRequestException('Record is already voided');

    const at =
      kind === 'readings'
        ? instant(body.observedAt, 'Reading time')
        : instant(body.occurredAt, 'Movement time');
    const oldAt = old.observed_at ?? old.occurred_at;
    const frozen = await this.rows(
      `SELECT id FROM fuel_reconciliations WHERE tank_id=$1 AND status='FINALIZED'
       AND ((period_from<=$2 AND period_to>=$2) OR (period_from<=$3 AND period_to>=$3)) LIMIT 1`,
      [tank.id, oldAt, at],
    );
    if (frozen.length)
      throw new BadRequestException(
        'Record is frozen by a finalized reconciliation',
      );

    let columns: string;
    let values: unknown[];
    let expressions: string;
    if (kind === 'readings') {
      const level = decimal(body.levelLitres, 'Fuel level');
      if (Number(level) > Number(tank.capacity_litres))
        throw new BadRequestException('Fuel level exceeds tank capacity');
      columns = 'observed_at,level_litres,source,method,notes';
      expressions = "$3,$4,'MANUAL',$5,$6";
      values = [
        at,
        level,
        optionalText(body.method, 80),
        optionalText(body.notes),
      ];
    } else if (kind === 'refills') {
      const quantity = decimal(body.quantityLitres, 'Refill quantity', 3, true);
      const hasPrice = body.unitPrice !== undefined && body.unitPrice !== '';
      if (body.currency && !hasPrice)
        throw new BadRequestException(
          'Unit price is required when currency is provided',
        );
      const unitPrice = hasPrice
        ? decimal(body.unitPrice, 'Unit price', 4)
        : null;
      const additional = hasPrice
        ? decimal(body.additionalCost ?? '0', 'Additional cost', 4)
        : null;
      columns =
        'occurred_at,quantity_litres,supplier,reference,notes,currency,unit_price,fuel_amount,additional_cost,total_amount';
      expressions =
        '$3,$4,$5,$6,$7,$8,$9,CASE WHEN $9::numeric IS NULL THEN NULL ELSE round($4::numeric*$9::numeric,4) END,$10,CASE WHEN $9::numeric IS NULL THEN NULL ELSE round($4::numeric*$9::numeric+$10::numeric,4) END';
      values = [
        at,
        quantity,
        optionalText(body.supplier, 160),
        optionalText(body.reference, 160),
        optionalText(body.notes),
        hasPrice ? currency(body.currency ?? 'TZS') : null,
        unitPrice,
        additional,
      ];
    } else {
      if (body.direction !== 'ADDITION' && body.direction !== 'REMOVAL')
        throw new BadRequestException('Direction must be ADDITION or REMOVAL');
      columns = 'occurred_at,direction,quantity_litres,reason,notes,reference';
      expressions = '$3,$4,$5,$6,$7,$8';
      values = [
        at,
        body.direction,
        decimal(body.quantityLitres, 'Adjustment quantity', 3, true),
        requiredText(body.reason, 'Reason', 160),
        optionalText(body.notes),
        optionalText(body.reference, 160),
      ];
    }
    const record = await this.db.transaction(async (manager) => {
      const lockedResult: unknown = await manager.query(
        `SELECT voided_at FROM ${table} WHERE id=$1 FOR UPDATE`,
        [id],
      );
      const locked = lockedResult as { voided_at: Date | null }[];
      if (locked[0]?.voided_at)
        throw new BadRequestException('Record is already voided');
      const replacementResult: unknown = await manager.query(
        `INSERT INTO ${table} (tank_id,recorded_by,corrected_from_id,${columns}) VALUES ($1,$2,$${values.length + 3},${expressions}) RETURNING *`,
        [tank.id, actor.sub, ...values, id],
      );
      const [replacement] = replacementResult as Record<string, unknown>[];
      await manager.query(
        `UPDATE ${table} SET voided_at=now(),voided_by=$2,void_reason=$3 WHERE id=$1`,
        [id, actor.sub, why],
      );
      await manager.query(
        'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          actor.sub,
          table,
          id,
          'CORRECT',
          why,
          JSON.stringify(old),
          JSON.stringify(replacement),
        ],
      );
      await this.auditTrail.record(
        {
          actorId: actor.sub,
          actorRole: actor.role,
          organizationId: tank.organization_id,
          action: 'FUEL_RECORD_CORRECTED',
          entityType: table,
          entityId: id,
          after: { status: 'CORRECTED' },
          reason: why,
        },
        manager,
      );
      return replacement;
    });
    return { record, equipmentId: tank.generator_id };
  }

  private async audit(
    actor: Actor,
    entity: string,
    id: string,
    action: string,
    reason: string | null,
    before: unknown,
    after: unknown,
  ) {
    await this.db.query(
      'INSERT INTO operational_audit(actor_id,entity_type,entity_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [
        actor.sub,
        entity,
        id,
        action,
        reason,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ],
    );
  }
}
