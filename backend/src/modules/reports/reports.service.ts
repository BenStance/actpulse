import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../devices/device.entity';
import { DeviceBinding } from '../devices/device-binding.entity';
import {
  EquipmentAccessService,
  MonitoringService,
  PeriodOptions,
} from '../monitoring/monitoring.service';

export type ReportFilters = PeriodOptions & {
  equipmentId?: string;
  deviceId?: string;
  organizationId?: string;
  siteId?: string;
  type?: string;
  page?: string;
  pageSize?: string;
};
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(DeviceBinding)
    private readonly bindings: Repository<DeviceBinding>,
    private readonly access: EquipmentAccessService,
    private readonly monitoring: MonitoringService,
  ) {}
  private async target(userId: string, filters: ReportFilters) {
    let id = filters.equipmentId;
    if (!id && filters.deviceId) {
      const device = await this.devices.findOne({
        where: { id: filters.deviceId },
      });
      id =
        device?.currentEquipmentId ??
        (
          await this.bindings.findOne({
            where: { deviceId: filters.deviceId },
            order: { startedAt: 'DESC' },
          })
        )?.equipmentId;
    }
    if (!id) throw new BadRequestException('Select equipment');
    return this.access.one(userId, id);
  }
  async equipmentReport(userId: string, filters: ReportFilters) {
    const row = await this.target(userId, filters);
    const period = this.monitoring.resolvePeriod(filters, row.site.timezone);
    const [metrics, snapshot] = await Promise.all([
      this.monitoring.metrics(row, period.from, period.to, period.timezone),
      this.monitoring.snapshot(row),
    ]);
    return {
      equipment: {
        id: row.id,
        name: row.name,
        type: row.type,
        site: {
          id: row.site.id,
          name: row.site.name,
          timezone: row.site.timezone,
        },
        monitoringDefinition: row.monitoringDefinition,
      },
      period: metrics.period,
      timezone: metrics.timezone,
      summary: {
        onMs: metrics.onMs,
        offMs: metrics.offMs,
        unknownMs: metrics.unknownMs,
        knownMs: metrics.knownMs,
        eligibleMs: metrics.eligibleMs,
        excludedMs: metrics.excludedMs,
        dataCoverage: metrics.dataCoverage,
        onShareOfKnown: metrics.onShareOfKnown,
        observedOnSessionCount: metrics.observedOnSessionCount,
        completedOnSessionCount: metrics.completedOnSessionCount,
        averageCompletedOnSessionMs: metrics.averageCompletedOnSessionMs,
        longestCompletedOnSessionMs: metrics.longestCompletedOnSessionMs,
        currentObservedOnSessionMs: metrics.currentObservedOnSessionMs,
        firstObservation: metrics.firstObservation,
        lastObservation: metrics.lastObservation,
      },
      daily: metrics.daily,
      segments: metrics.segments,
      sessions: metrics.sessions,
      snapshot,
    };
  }
  async events(userId: string, filters: ReportFilters) {
    const row = await this.target(userId, filters);
    const period = this.monitoring.resolvePeriod(filters, row.site.timezone);
    return {
      ...(await this.monitoring.events(
        row.id,
        period.from,
        period.to,
        Number(filters.page || 1),
        Number(filters.pageSize || 25),
      )),
      equipment: { id: row.id, name: row.name },
      period: { from: period.from, to: period.to, timezone: period.timezone },
    };
  }
  async fleet(userId: string, filters: ReportFilters) {
    const rows = await this.monitoring.scopedEquipment(userId, {
      organizationId: filters.organizationId,
      siteId: filters.siteId,
      type: filters.type,
    });
    const zones = [...new Set(rows.map((row) => row.site.timezone))];
    if (zones.length > 1 && !filters.timezone)
      throw new BadRequestException(
        'Select a reporting timezone for multiple sites',
      );
    const period = this.monitoring.resolvePeriod(
      filters,
      filters.timezone || zones[0] || 'Africa/Dar_es_Salaam',
    );
    const equipment = await Promise.all(
      rows.map(async (row) => {
        const [metrics, snapshot] = await Promise.all([
          this.monitoring.metrics(row, period.from, period.to, period.timezone),
          this.monitoring.snapshot(row),
        ]);
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          site: { id: row.site.id, name: row.site.name },
          monitoringDefinition: row.monitoringDefinition,
          onMs: metrics.onMs,
          offMs: metrics.offMs,
          unknownMs: metrics.unknownMs,
          eligibleMs: metrics.eligibleMs,
          knownMs: metrics.knownMs,
          dataCoverage: metrics.dataCoverage,
          completedOnSessionCount: metrics.completedOnSessionCount,
          averageCompletedOnSessionMs: metrics.averageCompletedOnSessionMs,
          longestCompletedOnSessionMs: metrics.longestCompletedOnSessionMs,
          snapshot,
        };
      }),
    );
    const sum = (
      key: 'onMs' | 'offMs' | 'unknownMs' | 'eligibleMs' | 'knownMs',
    ) => equipment.reduce((total, row) => total + row[key], 0);
    const eligibleMs = sum('eligibleMs'),
      knownMs = sum('knownMs'),
      onMs = sum('onMs');
    return {
      period: { from: period.from, to: period.to, timezone: period.timezone },
      units: 'equipment-hours',
      totals: {
        equipment: equipment.length,
        onMs,
        offMs: sum('offMs'),
        unknownMs: sum('unknownMs'),
        eligibleMs,
        dataCoverage: eligibleMs ? knownMs / eligibleMs : null,
        onShareOfKnown: knownMs ? onMs / knownMs : null,
      },
      equipment,
    };
  }
  async csv(userId: string, filters: ReportFilters) {
    const report = await this.fleet(userId, filters);
    const columnCount = 14;
    const utf8Bom = '\uFEFF';

    const escapeCell = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number')
        return Number.isFinite(value) ? String(value) : '';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';

      const text =
        value instanceof Date
          ? value.toISOString()
          : typeof value === 'string'
            ? value
            : (JSON.stringify(value) ?? '');
      // Prevent spreadsheet programs from evaluating user-controlled text.
      const safeText = /^[=+@-]/.test(text.trimStart()) ? `'${text}` : text;
      return /[",\r\n\t]/.test(safeText) || /^\s|\s$/.test(safeText)
        ? `"${safeText.replaceAll('"', '""')}"`
        : safeText;
    };
    const csvRow = (cells: unknown[] = []): string => {
      const normalized = cells.slice(0, columnCount);
      while (normalized.length < columnCount) normalized.push('');
      return normalized.map(escapeCell).join(',');
    };
    const hours = (milliseconds: number | null): number | '' =>
      milliseconds === null
        ? ''
        : Number((milliseconds / 3_600_000).toFixed(2));
    const percentage = (ratio: number | null): number | '' =>
      ratio === null ? '' : Number((ratio * 100).toFixed(2));

    const rows: unknown[][] = [
      ['ACTPulse Fleet Duration Report'],
      ['Report information'],
      ['Field', 'Value'],
      ['Generated at (UTC)', new Date().toISOString()],
      ['Period start (UTC)', report.period.from.toISOString()],
      ['Period end (UTC)', report.period.to.toISOString()],
      ['Reporting timezone', report.period.timezone],
      ['Equipment in scope', report.totals.equipment],
      [],
      ['Fleet summary'],
      ['Metric', 'Value', 'Unit'],
      ['Observed ON', hours(report.totals.onMs), 'equipment-hours'],
      ['Observed OFF', hours(report.totals.offMs), 'equipment-hours'],
      ['Unknown', hours(report.totals.unknownMs), 'equipment-hours'],
      ['Eligible period', hours(report.totals.eligibleMs), 'equipment-hours'],
      ['Data coverage', percentage(report.totals.dataCoverage), 'percent'],
      [
        'ON share of known time',
        percentage(report.totals.onShareOfKnown),
        'percent',
      ],
      [],
      ['Methodology'],
      [
        'UTC event storage; the selected timezone is used for calendar-day grouping. Unknown intervals are excluded from known ON/OFF ratios and are never counted as OFF.',
      ],
      [],
      ['Equipment details'],
      [
        'Equipment',
        'Site',
        'Type',
        'Monitoring definition',
        'Current state',
        'Connectivity',
        'ON hours',
        'OFF hours',
        'Unknown hours',
        'Eligible hours',
        'Coverage (%)',
        'Completed ON sessions',
        'Average completed session (hours)',
        'Longest completed session (hours)',
      ],
    ];

    const equipment = [...report.equipment].sort(
      (left, right) =>
        left.site.name.localeCompare(right.site.name) ||
        left.name.localeCompare(right.name),
    );
    for (const item of equipment)
      rows.push([
        item.name,
        item.site.name,
        item.type,
        item.monitoringDefinition ?? 'Unclassified',
        item.snapshot?.state ?? 'UNKNOWN',
        item.snapshot?.connectivity ?? 'NEVER_CONNECTED',
        hours(item.onMs),
        hours(item.offMs),
        hours(item.unknownMs),
        hours(item.eligibleMs),
        percentage(item.dataCoverage),
        item.completedOnSessionCount,
        hours(item.averageCompletedOnSessionMs),
        hours(item.longestCompletedOnSessionMs),
      ]);

    return `${utf8Bom}${rows.map(csvRow).join('\r\n')}\r\n`;
  }
}
