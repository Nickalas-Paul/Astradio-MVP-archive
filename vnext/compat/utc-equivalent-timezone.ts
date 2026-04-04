/**
 * UTC / GMT placeholder IANA names that must not stand in for a real birth location
 * when geographic coordinates can resolve a zone. Shared by resolver (server) and UI guard (client).
 */

export function isUtcEquivalentChartTimezone(name: string | null | undefined): boolean {
  if (name == null || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t) return false;
  const upper = t.toUpperCase();
  if (upper === 'UTC') return true;
  if (t === 'Etc/UTC') return true;
  if (upper === 'GMT') return true;
  if (t === 'Etc/GMT' || t === 'Etc/GMT+0' || t === 'Etc/GMT-0') return true;
  return false;
}
