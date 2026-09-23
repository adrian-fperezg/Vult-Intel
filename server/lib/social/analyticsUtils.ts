/**
 * Pure helpers for Social Studio analytics (covered by analyticsUtils.test.ts).
 * All day keys are UTC (YYYY-MM-DD) so series from different platforms line up.
 */

export interface DayMetric {
  date: string;
  impressions: number;
  engagements: number;
  reach: number;
}

export interface AnalyticsRange {
  days: number;
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  sinceTs: number;
  untilTs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

export function buildDateRange(days: number, now: Date = new Date()): AnalyticsRange {
  const to = now;
  const from = new Date(to.getTime() - days * DAY_MS);
  return {
    days,
    from,
    to,
    prevFrom: new Date(from.getTime() - days * DAY_MS),
    prevTo: from,
    sinceTs: Math.floor(from.getTime() / 1000),
    untilTs: Math.floor(to.getTime() / 1000),
  };
}

// Splits [from, to] into consecutive windows of at most maxDays (unix seconds).
export function splitRange(from: Date, to: Date, maxDays: number): { since: number; until: number }[] {
  const windows: { since: number; until: number }[] = [];
  let start = from.getTime();
  const end = to.getTime();
  while (start < end) {
    const stop = Math.min(start + maxDays * DAY_MS, end);
    windows.push({ since: Math.floor(start / 1000), until: Math.floor(stop / 1000) });
    start = stop;
  }
  return windows;
}

export function fillDailySeries(from: Date, to: Date, raw: Record<string, DayMetric>): DayMetric[] {
  const out: DayMetric[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (cursor.getTime() <= to.getTime()) {
    const key = dayKey(cursor);
    out.push(raw[key] || { date: key, impressions: 0, engagements: 0, reach: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// Meta daily values are stamped with the END of the day they describe.
export function metaDayKey(endTime: string): string {
  return dayKey(new Date(new Date(endTime).getTime() - DAY_MS));
}

export function rate(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export function sumNullable(values: (number | null | undefined)[]): number | null {
  const known = values.filter((v): v is number => typeof v === 'number');
  return known.length ? known.reduce((s, v) => s + v, 0) : null;
}

/**
 * Growth across accounts, using only accounts that report BOTH periods.
 * Returns null when no account has comparable data (the UI then hides the badge).
 */
export function growth(pairs: [number | null | undefined, number | null | undefined][]): { value: number; pct: number } | null {
  let curr = 0, prev = 0, any = false;
  for (const [c, p] of pairs) {
    if (typeof c === 'number' && typeof p === 'number') { curr += c; prev += p; any = true; }
  }
  if (!any) return null;
  const pct = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 1000) / 10;
  return { value: curr - prev, pct };
}
