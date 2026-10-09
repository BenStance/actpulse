import { SensorStatus } from '../../common/enums/sensor-status.enum';

export type Observation = {
  id: string;
  deviceId: string;
  status: SensorStatus;
  recordedAt: Date;
  kind: string;
};
export type BindingWindow = {
  deviceId: string;
  startedAt: Date;
  endedAt: Date | null;
  timeoutMs: number;
};
export type DurationSegment = {
  start: string;
  end: string;
  durationMs: number;
  state: 'ON' | 'OFF' | 'UNKNOWN';
  deviceId: string | null;
};
export type ObservedSession = {
  start: string;
  end: string | null;
  durationMs: number;
  status: 'COMPLETED' | 'ONGOING' | 'INTERRUPTED';
  deviceId: string;
  dataQuality: 'OBSERVED' | 'CLIPPED';
};

const clip = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export function calculateDurations(
  observations: Observation[],
  bindings: BindingWindow[],
  from: Date,
  to: Date,
  now = new Date(),
) {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const windows = bindings
    .map((binding) => ({
      ...binding,
      start: clip(binding.startedAt.getTime(), fromMs, toMs),
      end: clip(binding.endedAt?.getTime() ?? toMs, fromMs, toMs),
    }))
    .filter((window) => window.end > window.start)
    .sort((a, b) => a.start - b.start);
  const segments: DurationSegment[] = [];
  let eligibleMs = 0;
  let firstObservation: Date | null = null;
  let lastObservation: Date | null = null;
  for (const window of windows) {
    eligibleMs += window.end - window.start;
    const rows = observations
      .filter(
        (row) =>
          row.deviceId === window.deviceId &&
          row.recordedAt.getTime() >= window.startedAt.getTime() &&
          (window.endedAt === null ||
            row.recordedAt.getTime() < window.endedAt.getTime()) &&
          row.recordedAt.getTime() <= window.end,
      )
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    const known: Array<{ start: number; end: number; state: 'ON' | 'OFF' }> =
      [];
    rows.forEach((row, index) => {
      const observed = row.recordedAt.getTime();
      if (!firstObservation || observed < firstObservation.getTime())
        firstObservation = row.recordedAt;
      if (!lastObservation || observed > lastObservation.getTime())
        lastObservation = row.recordedAt;
      const next = rows[index + 1]?.recordedAt.getTime() ?? window.end;
      const end = Math.min(
        next,
        observed + window.timeoutMs,
        window.end,
        now.getTime(),
      );
      const start = Math.max(observed, window.start);
      if (end > start) known.push({ start, end, state: row.status });
    });
    let cursor = window.start;
    for (const item of known) {
      if (item.start > cursor)
        segments.push(
          makeSegment(cursor, item.start, 'UNKNOWN', window.deviceId),
        );
      if (item.end > cursor)
        segments.push(
          makeSegment(
            Math.max(cursor, item.start),
            item.end,
            item.state,
            window.deviceId,
          ),
        );
      cursor = Math.max(cursor, item.end);
    }
    if (cursor < window.end)
      segments.push(
        makeSegment(cursor, window.end, 'UNKNOWN', window.deviceId),
      );
  }
  const merged: DurationSegment[] = [];
  for (const segment of segments) {
    const prev = merged.at(-1);
    if (
      prev &&
      prev.end === segment.start &&
      prev.state === segment.state &&
      prev.deviceId === segment.deviceId
    ) {
      prev.end = segment.end;
      prev.durationMs += segment.durationMs;
    } else merged.push({ ...segment });
  }
  const onMs = merged
    .filter((s) => s.state === 'ON')
    .reduce((sum, s) => sum + s.durationMs, 0);
  const offMs = merged
    .filter((s) => s.state === 'OFF')
    .reduce((sum, s) => sum + s.durationMs, 0);
  const unknownMs = Math.max(0, eligibleMs - onMs - offMs);
  const knownMs = onMs + offMs;
  const sessions: ObservedSession[] = merged.flatMap((segment, index) => {
    if (segment.state !== 'ON' || !segment.deviceId) return [];
    const next = merged[index + 1];
    const completed =
      next?.state === 'OFF' &&
      next.start === segment.end &&
      next.deviceId === segment.deviceId;
    const ongoing =
      !completed &&
      segment.end === to.toISOString() &&
      Math.abs(toMs - now.getTime()) <= 1000 &&
      !next;
    return [
      {
        start: segment.start,
        end: ongoing ? null : segment.end,
        durationMs: segment.durationMs,
        status: completed
          ? ('COMPLETED' as const)
          : ongoing
            ? ('ONGOING' as const)
            : ('INTERRUPTED' as const),
        deviceId: segment.deviceId,
        dataQuality:
          segment.start === from.toISOString()
            ? ('CLIPPED' as const)
            : ('OBSERVED' as const),
      },
    ];
  });
  const completed = sessions.filter((s) => s.status === 'COMPLETED');
  const completedTotal = completed.reduce((sum, s) => sum + s.durationMs, 0);
  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    onMs,
    offMs,
    unknownMs,
    knownMs,
    eligibleMs,
    excludedMs: Math.max(0, toMs - fromMs - eligibleMs),
    dataCoverage: eligibleMs ? knownMs / eligibleMs : null,
    onShareOfKnown: knownMs ? onMs / knownMs : null,
    observedOnSessionCount: sessions.length,
    completedOnSessionCount: completed.length,
    averageCompletedOnSessionMs: completed.length
      ? completedTotal / completed.length
      : null,
    longestCompletedOnSessionMs: completed.length
      ? Math.max(...completed.map((s) => s.durationMs))
      : null,
    currentObservedOnSessionMs:
      sessions.find((s) => s.status === 'ONGOING')?.durationMs ?? null,
    firstObservation: firstObservation
      ? (firstObservation as Date).toISOString()
      : null,
    lastObservation: lastObservation
      ? (lastObservation as Date).toISOString()
      : null,
    segments: merged,
    sessions,
  };
}

function makeSegment(
  start: number,
  end: number,
  state: 'ON' | 'OFF' | 'UNKNOWN',
  deviceId: string,
): DurationSegment {
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    durationMs: end - start,
    state,
    deviceId,
  };
}

const formatters = new Map<string, Intl.DateTimeFormat>();
export function localDay(date: Date, timezone: string): string {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function nextCalendarDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
export function utcForLocalMidnight(day: string, timezone: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const target = Date.UTC(year, month - 1, date);
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(new Date(guess));
    const val = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const wall = Date.UTC(
      val('year'),
      val('month') - 1,
      val('day'),
      val('hour'),
      val('minute'),
      val('second'),
    );
    const delta = wall - target;
    if (delta === 0) break;
    guess -= delta;
  }
  return new Date(guess);
}
export function dailyDurations(
  segments: DurationSegment[],
  from: Date,
  to: Date,
  timezone: string,
) {
  const result: Array<{
    day: string;
    onMs: number;
    offMs: number;
    unknownMs: number;
    eligibleMs: number;
    dataCoverage: number | null;
    observedOnSessionCount: number;
  }> = [];
  let day = localDay(from, timezone);
  const lastDay = localDay(new Date(to.getTime() - 1), timezone);
  while (day <= lastDay && result.length < 367) {
    const start = Math.max(
      from.getTime(),
      utcForLocalMidnight(day, timezone).getTime(),
    );
    const end = Math.min(
      to.getTime(),
      utcForLocalMidnight(nextCalendarDay(day), timezone).getTime(),
    );
    const totals = { onMs: 0, offMs: 0, unknownMs: 0 };
    for (const segment of segments) {
      const duration = Math.max(
        0,
        Math.min(end, new Date(segment.end).getTime()) -
          Math.max(start, new Date(segment.start).getTime()),
      );
      if (segment.state === 'ON') totals.onMs += duration;
      else if (segment.state === 'OFF') totals.offMs += duration;
      else totals.unknownMs += duration;
    }
    const eligibleMs = totals.onMs + totals.offMs + totals.unknownMs;
    result.push({
      day,
      ...totals,
      eligibleMs,
      dataCoverage: eligibleMs
        ? (totals.onMs + totals.offMs) / eligibleMs
        : null,
      observedOnSessionCount: segments.filter(
        (s) =>
          s.state === 'ON' && localDay(new Date(s.start), timezone) === day,
      ).length,
    });
    day = nextCalendarDay(day);
  }
  return result;
}
