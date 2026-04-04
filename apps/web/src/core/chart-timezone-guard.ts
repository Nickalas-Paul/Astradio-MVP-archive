import { isUtcEquivalentChartTimezone } from '../../../../vnext/compat/utc-equivalent-timezone';

/**
 * Birth-chart save guard (client): reject UTC/GMT placeholders and invalid IANA.
 * Uses Intl — no Node-only deps for browser bundle safety.
 */
export function isPersistableChartTimezone(tz: string): boolean {
  const t = tz.trim();
  if (!t || isUtcEquivalentChartTimezone(t)) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: t });
    return true;
  } catch {
    return false;
  }
}
