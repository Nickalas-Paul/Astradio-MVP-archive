/**
 * Natal birth key: date, time, lat, lon, resolved timezone. Shared by memory-store and
 * lib/pg-store (pg loads compiled output from dist after `npm run vnext:build`).
 */
import { resolveChartTimezoneForChartInsert } from './chart-timezone-resolve';

export function normDate(d: unknown): string {
  return String(d == null ? '' : d).slice(0, 10);
}

export function normTime(t: unknown): string {
  const s = String(t == null ? '' : t);
  if (!s) return '12:00';
  return s.length >= 5 ? s.slice(0, 5) : s;
}

/** @returns true when natal-driving fields differ → clear identity_export_id */
export function natalBirthKeyChanged(
  before: { date: string; time: string; lat: number; lon: number; timezone?: string | null },
  input: { date: string; time: string; lat: number; lon: number; timezone?: string; tz?: string },
  resolvedTimezoneForInput: string
): boolean {
  const resBefore = resolveChartTimezoneForChartInsert({
    timezone: before.timezone,
    lat: before.lat,
    lon: before.lon,
  });
  if (normDate(before.date) !== normDate(input.date)) return true;
  if (normTime(before.time) !== normTime(input.time)) return true;
  if (Number(before.lat) !== Number(input.lat)) return true;
  if (Number(before.lon) !== Number(input.lon)) return true;
  const tzNew = String(resolvedTimezoneForInput || '').trim();
  const tzOld = String(resBefore || '').trim();
  return tzOld !== tzNew;
}
