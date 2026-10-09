import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  EquipmentAccessService,
  MonitoringService,
} from '../monitoring/monitoring.service';
import { Actor, pageParams } from './operations.util';

export type ReportType =
  | 'equipment'
  | 'fleet'
  | 'fuel'
  | 'reconciliation'
  | 'costs'
  | 'maintenance'
  | 'alerts';

@Injectable()
export class OperationalReportsService {
  constructor(
    private readonly db: DataSource,
    private readonly access: EquipmentAccessService,
    private readonly monitoring: MonitoringService,
  ) {}
  private rows<T>(sql: string, args: unknown[] = []): Promise<T[]> {
    return this.db.query(sql, args);
  }
  private async scope(actor: Actor, query: Record<string, unknown>) {
    const all = await this.access.ids(actor.sub);
    if (
      query.equipmentId &&
      (typeof query.equipmentId !== 'string' ||
        !all.includes(query.equipmentId))
    )
      throw new NotFoundException('Equipment not found');
    if (actor.role !== 'Admin' && query.organizationId)
      throw new BadRequestException('Organization filter is Admin-only');
    if (!all.length) return [];
    return this.rows<{
      id: string;
      name: string;
      type: string;
      organization_id: string;
      site_id: string;
      site_name: string;
      timezone: string;
      monitoring_definition: string | null;
    }>(
      `SELECT e.id,e.name,e.type,e.organization_id,e.site_id,s.name site_name,s.timezone,e.monitoring_definition FROM equipment e JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[])
      AND ($2::uuid IS NULL OR e.organization_id=$2) AND ($3::uuid IS NULL OR e.site_id=$3)
      AND ($4::text IS NULL OR e.type=$4) AND ($5::uuid IS NULL OR e.id=$5) ORDER BY e.name LIMIT 501`,
      [
        all,
        query.organizationId || null,
        query.siteId || null,
        query.equipmentType || null,
        query.equipmentId || null,
      ],
    );
  }
  async report(actor: Actor, query: Record<string, unknown>) {
    const type = (
      typeof query.type === 'string' ? query.type : 'fleet'
    ) as ReportType;
    if (
      ![
        'equipment',
        'fleet',
        'fuel',
        'reconciliation',
        'costs',
        'maintenance',
        'alerts',
      ].includes(type)
    )
      throw new BadRequestException('Invalid report type');
    const equipment = await this.scope(actor, query);
    if (equipment.length > 500)
      throw new BadRequestException(
        'Narrow report scope to at most 500 equipment records',
      );
    const timezone =
      typeof query.timezone === 'string'
        ? query.timezone
        : equipment[0]?.timezone || 'Africa/Dar_es_Salaam';
    const period = this.monitoring.resolvePeriod(
      {
        preset: query.preset as string | undefined,
        from: query.from as string | undefined,
        to: query.to as string | undefined,
        timezone,
      },
      timezone,
    );
    const { take, skip, page, pageSize } = pageParams(
      query.page,
      query.pageSize,
    );
    const ids = equipment.map((row) => row.id);
    const common = {
      type,
      period: { from: period.from, to: period.to, timezone },
      scope: {
        equipmentCount: equipment.length,
        organizationId:
          actor.role === 'Admin' ? query.organizationId || null : null,
        siteId: query.siteId || null,
        equipmentId: query.equipmentId || null,
      },
      page,
      pageSize,
      methodology:
        'UTC event storage; selected timezone is used for calendar-day grouping. Unknown monitoring intervals are excluded from known ON/OFF ratios.',
    };
    if (!ids.length) return { ...common, summary: {}, items: [], total: 0 };
    if (type === 'equipment' || type === 'fleet') {
      const results = await Promise.all(
        equipment.map(async (item) => {
          const entity = await this.access.one(actor.sub, item.id);
          const metrics = await this.monitoring.metrics(
            entity,
            period.from,
            period.to,
            timezone,
          );
          const snapshot = await this.monitoring.snapshot(entity);
          return {
            equipmentId: item.id,
            equipment: item.name,
            site: item.site_name,
            type: item.type,
            monitoringDefinition: item.monitoring_definition,
            state: snapshot.state,
            connectivity: snapshot.connectivity,
            onMs: metrics.onMs,
            offMs: metrics.offMs,
            unknownMs: metrics.unknownMs,
            eligibleMs: metrics.eligibleMs,
            coverage: metrics.dataCoverage,
            sessionCount: metrics.observedOnSessionCount,
          };
        }),
      );
      const sum = (key: 'onMs' | 'offMs' | 'unknownMs' | 'eligibleMs') =>
        results.reduce((total, row) => total + row[key], 0);
      const eligible = sum('eligibleMs'),
        known = sum('onMs') + sum('offMs');
      return {
        ...common,
        summary: {
          equipment: results.length,
          onEquipmentHours: sum('onMs') / 3600000,
          offEquipmentHours: sum('offMs') / 3600000,
          unknownEquipmentHours: sum('unknownMs') / 3600000,
          dataCoverage: eligible ? known / eligible : null,
          onShareOfKnown: known ? sum('onMs') / known : null,
        },
        items: results.slice(skip, skip + take),
        total: results.length,
      };
    }
    const tableSql: Record<
      Exclude<ReportType, 'equipment' | 'fleet'>,
      string
    > = {
      fuel: `SELECT 'READING' kind,e.id equipment_id,e.name equipment,s.name site,r.observed_at at,r.level_litres quantity,r.source,null::char(3) currency,null::numeric amount FROM fuel_readings r JOIN fuel_tanks t ON t.id=r.tank_id JOIN equipment e ON e.id=t.generator_id JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[]) AND r.voided_at IS NULL AND r.observed_at>$2 AND r.observed_at<=$3
        UNION ALL SELECT 'REFILL',e.id,e.name,s.name,f.occurred_at,f.quantity_litres,'MANUAL',f.currency,f.total_amount FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id JOIN equipment e ON e.id=t.generator_id JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.occurred_at>$2 AND f.occurred_at<=$3`,
      reconciliation: `SELECT r.status kind,e.id equipment_id,e.name equipment,s.name site,r.period_to at,r.apparent_usage_litres quantity,'CALCULATED' source,null::char(3) currency,r.variance_litres amount FROM fuel_reconciliations r JOIN fuel_tanks t ON t.id=r.tank_id JOIN equipment e ON e.id=t.generator_id JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[]) AND r.period_to>$2 AND r.period_to<=$3`,
      costs: `SELECT 'PURCHASE' kind,e.id equipment_id,e.name equipment,s.name site,f.occurred_at at,f.quantity_litres quantity,'RECORDED' source,f.currency,f.total_amount amount FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id JOIN equipment e ON e.id=t.generator_id JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.currency IS NOT NULL AND f.occurred_at>$2 AND f.occurred_at<=$3
        UNION ALL SELECT 'SERVICE',e.id,e.name,s.name,sr.performed_at,NULL,'RECORDED',sr.currency,sr.cost FROM service_records sr JOIN equipment e ON e.id=sr.equipment_id JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[]) AND sr.voided_at IS NULL AND sr.currency IS NOT NULL AND sr.performed_at>$2 AND sr.performed_at<=$3`,
      maintenance: `SELECT 'SERVICE' kind,e.id equipment_id,e.name equipment,s.name site,sr.performed_at at,sr.meter_hours quantity,'MANUAL' source,sr.currency,sr.cost amount FROM service_records sr JOIN equipment e ON e.id=sr.equipment_id JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[]) AND sr.voided_at IS NULL AND sr.performed_at>$2 AND sr.performed_at<=$3`,
      alerts: `SELECT a.status kind,e.id equipment_id,e.name equipment,s.name site,a.triggered_at at,NULL::numeric quantity,a.type source,NULL::char(3) currency,NULL::numeric amount FROM alerts a JOIN equipment e ON e.id=a.equipment_id JOIN sites s ON s.id=e.site_id WHERE e.id=ANY($1::uuid[]) AND a.triggered_at>$2 AND a.triggered_at<=$3`,
    };
    const sql = `SELECT * FROM (${tableSql[type]}) events`;
    const [count] = await this.rows<{ total: string }>(
      `SELECT count(*)::text total FROM (${sql}) counted`,
      [ids, period.from, period.to],
    );
    if (Number(count.total) > 5000 && query.export === 'true')
      throw new BadRequestException(
        'Export is limited to 5,000 rows; narrow the date range',
      );
    const items = await this.rows<{
      kind: string;
      quantity: string | null;
      currency: string | null;
      amount: string | null;
    }>(`${sql} ORDER BY at DESC,equipment_id LIMIT $4 OFFSET $5`, [
      ids,
      period.from,
      period.to,
      take,
      skip,
    ]);
    const byKind = await this.rows<{
      kind: string;
      currency: string | null;
      events: string;
      amount: string;
      quantity: string;
    }>(
      `SELECT kind,currency,count(*)::text events,coalesce(sum(amount),0)::text amount,coalesce(sum(quantity),0)::text quantity FROM (${sql}) totals GROUP BY kind,currency ORDER BY kind,currency`,
      [ids, period.from, period.to],
    );
    const byCurrency =
      type === 'costs'
        ? byKind.map((row) => ({
            kind: row.kind,
            currency: row.currency,
            amount: row.amount,
            quantity: row.quantity,
          }))
        : [];
    const weightedPrices =
      type === 'costs'
        ? await this.rows<{ currency: string; price: string | null }>(
            `SELECT f.currency,CASE WHEN sum(f.quantity_litres)>0 THEN (sum(f.fuel_amount)/sum(f.quantity_litres))::text ELSE NULL END price FROM fuel_refills f JOIN fuel_tanks t ON t.id=f.tank_id WHERE t.generator_id=ANY($1::uuid[]) AND f.voided_at IS NULL AND f.currency IS NOT NULL AND f.occurred_at>$2 AND f.occurred_at<=$3 GROUP BY f.currency ORDER BY f.currency`,
            [ids, period.from, period.to],
          )
        : [];
    return {
      ...common,
      summary: {
        byCurrency,
        byKind,
        weightedPurchasePriceByCurrency: weightedPrices,
        purchasedLitres:
          type === 'fuel' || type === 'costs'
            ? byKind
                .filter(
                  (row) => row.kind === 'REFILL' || row.kind === 'PURCHASE',
                )
                .reduce((total, row) => total + Number(row.quantity), 0)
                .toFixed(3)
            : null,
        finalizedApparentLitres:
          type === 'reconciliation'
            ? byKind
                .filter((row) => row.kind === 'FINALIZED')
                .reduce((total, row) => total + Number(row.quantity), 0)
                .toFixed(3)
            : null,
        events: Number(count.total),
        units:
          type === 'costs'
            ? 'amount by currency and purchase litres'
            : type === 'alerts'
              ? 'event count'
              : 'litres and event count',
      },
      items,
      total: Number(count.total),
    };
  }

 async csv(actor: Actor, query: Record<string, unknown>) {
  const first = await this.report(actor, {
    ...query,
    page: 1,
    pageSize: 100,
    export: 'true',
  });
  const pages = Math.ceil(first.total / 100);
  if (pages > 50)
    throw new BadRequestException('CSV export exceeds 5,000 rows');
  const items = [...first.items];
  for (let page = 2; page <= pages; page++)
    items.push(
      ...(
        await this.report(actor, {
          ...query,
          page,
          pageSize: 100,
          export: 'true',
        })
      ).items,
    );

    /* ------------------------------------------------------------------ */
/*  Human labels + CSV labels for each report type                     */
/* ------------------------------------------------------------------ */
const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  equipment: 'Equipment Operations',
  fleet: 'Site / Fleet Summary',
  fuel: 'Fuel Readings & Refills',
  reconciliation: 'Fuel Reconciliation',
  costs: 'Fuel & Service Costs',
  maintenance: 'Maintenance',
  alerts: 'Alerts & Events',
};

/**
 * Turns `onEquipmentHours` into `On equipment hours`, `equipment_id`
 * into `Equipment id`, `at` stays `At`. Used for CSV column headers so
 * Excel shows readable labels instead of internal field names.
 */
function humanizeLabel(key: string): string {
  return key
    .replaceAll('_', ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
  /* ---------------------------------------------------------------- */
  /*  CSV helpers — proper escaping, BOM, safe formulas               */
  /* ---------------------------------------------------------------- */
  const CSV_UTF8_BOM = '\uFEFF';

  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const text =
      value instanceof Date
        ? value.toISOString()
        : typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ? String(value)
          : '';
    // Neutralise formula-injection (=, +, @, -) at the start of a cell
    const neutral = /^[=+@-]/.test(text.trimStart()) ? `'${text}` : text;
    // Always quote strings that contain commas, quotes, CR/LF, or leading
    // whitespace. Numbers stay bare so Excel renders them as numbers.
    const needsQuotes = /[",\r\n\t]/.test(neutral) || /^\s|\s$/.test(neutral);
    if (needsQuotes) {
      return `"${neutral.replaceAll('"', '""')}"`;
    }
    return neutral;
  };

  const row = (cells: unknown[]): string =>
    cells.map(escape).join(',');

  const blankRow = '';

  /* ---------------------------------------------------------------- */
  /*  Metadata block — one column of labels + one column of values    */
  /* ---------------------------------------------------------------- */
  const lines: string[] = [];

  lines.push(row(['ACTPulse — Operational Report']));
  lines.push(
    row([
      'Report type',
      REPORT_TYPE_LABEL[first.type as ReportType] || first.type,
    ])
  );
  lines.push(row(['Generated (UTC)', new Date().toISOString()]));
  lines.push(
    row(['Period from (UTC)', first.period.from.toISOString()])
  );
  lines.push(row(['Period to (UTC)', first.period.to.toISOString()]));
  lines.push(row(['Reporting timezone', first.period.timezone]));
  lines.push(
    row(['Scope · equipment', first.scope.equipmentCount])
  );
  if (first.scope.organizationId)
    lines.push(row(['Scope · organization', first.scope.organizationId]));
  if (first.scope.siteId)
    lines.push(row(['Scope · site', first.scope.siteId]));
  if (first.scope.equipmentId)
    lines.push(row(['Scope · equipment ID', first.scope.equipmentId]));
  lines.push(row(['Total records', first.total]));

  lines.push(blankRow);

  /* ---------------------------------------------------------------- */
  /*  Methodology block                                               */
  /* ---------------------------------------------------------------- */
  lines.push(row(['Methodology']));
  lines.push(row([first.methodology]));
  lines.push(blankRow);

  /* ---------------------------------------------------------------- */
  /*  Summary block — grouped by kind, then by currency               */
  /* ---------------------------------------------------------------- */
  const summary = first.summary as Record<string, unknown>;
  const byKind = (summary.byKind as Array<Record<string, unknown>>) || [];
  const byCurrency =
    (summary.byCurrency as Array<Record<string, unknown>>) || [];
  const weightedPrices =
    (summary.weightedPurchasePriceByCurrency as Array<
      Record<string, unknown>
    >) || [];

  lines.push(row(['Summary']));

  // Scalar summary fields
  const scalarKeys = Object.keys(summary).filter(
    (key) =>
      ![
        'byKind',
        'byCurrency',
        'weightedPurchasePriceByCurrency',
      ].includes(key)
  );
  for (const key of scalarKeys) {
    const value = summary[key];
    lines.push(
      row([humanizeLabel(key), value === null ? '' : String(value)])
    );
  }
  lines.push(blankRow);

  // byKind table
  if (byKind.length) {
    lines.push(row(['Events by kind']));
    lines.push(
      row([
        'Kind',
        'Currency',
        'Events',
        'Amount',
        'Quantity',
      ])
    );
    for (const r of byKind) {
      lines.push(
        row([
          r.kind ?? '',
          r.currency ?? '',
          r.events ?? '',
          r.amount ?? '',
          r.quantity ?? '',
        ])
      );
    }
    lines.push(blankRow);
  }

  // byCurrency table (costs report only)
  if (byCurrency.length) {
    lines.push(row(['Amounts by currency']));
    lines.push(
      row(['Kind', 'Currency', 'Amount', 'Quantity'])
    );
    for (const r of byCurrency) {
      lines.push(
        row([
          r.kind ?? '',
          r.currency ?? '',
          r.amount ?? '',
          r.quantity ?? '',
        ])
      );
    }
    lines.push(blankRow);
  }

  // Weighted purchase price
  if (weightedPrices.length) {
    lines.push(row(['Weighted purchase price by currency']));
    lines.push(row(['Currency', 'Price per litre']));
    for (const r of weightedPrices) {
      lines.push(row([r.currency ?? '', r.price ?? '']));
    }
    lines.push(blankRow);
  }

  /* ---------------------------------------------------------------- */
  /*  Detail table                                                    */
  /* ---------------------------------------------------------------- */
  const keys = items.length ? Object.keys(items[0]).slice(0, 12) : [];
  lines.push(row(['Detail']));
  if (keys.length) {
    lines.push(row(keys.map((k) => humanizeLabel(k))));
  }
  for (const rowItem of items as Array<Record<string, unknown>>) {
    lines.push(row(keys.map((k) => rowItem[k])));
  }

  /* ---------------------------------------------------------------- */
  /*  Prefix with BOM so Excel detects UTF-8                          */
  /* ---------------------------------------------------------------- */
  return CSV_UTF8_BOM + lines.join('\r\n') + '\r\n';
}
}
