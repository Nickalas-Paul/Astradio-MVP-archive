/**
 * Single chart timezone resolver — mandatory order:
 * 1) valid client IANA (timezone or tz) → use it
 * 2) else lat/lon finite → tzlookup + IANA validation
 * 3) else fail closed (no UTC or server defaults)
 *
 * Used by chart INSERT paths, backfill, and memory adapter. Do not duplicate tzlookup elsewhere for persistence.
 */

const tzlookup = require('tzlookup');
const moment = require('moment-timezone');

/** @param {string} name */
function isValidIanaTimezone(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t) return false;
  return Boolean(moment.tz.zone(t));
}

/**
 * Normalize client-provided IANA or geographic resolution for chart rows.
 * @param {{ timezone?: string|null, tz?: string|null, lat: number, lon: number }} input
 * @returns {string}
 */
function resolveChartTimezoneForChartInsert(input) {
  const clientRaw = input.timezone != null ? input.timezone : input.tz;
  if (clientRaw != null && String(clientRaw).trim()) {
    const c = String(clientRaw).trim();
    if (isValidIanaTimezone(c)) return c;
    const err = new Error('Invalid IANA timezone');
    err.code = 'INVALID_CHART_TIMEZONE';
    throw err;
  }

  const lat = input.lat;
  const lon = input.lon;
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
    let name;
    try {
      name = tzlookup.tzNameAt(lat, lon);
    } catch (e) {
      const err = new Error('Geographic timezone lookup failed');
      err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
      err.cause = e;
      throw err;
    }
    if (name && typeof name === 'string' && name.trim() && isValidIanaTimezone(name)) {
      return name.trim();
    }
    const err = new Error('Geographic timezone lookup produced invalid or empty zone');
    err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
    throw err;
  }

  const err = new Error('Timezone required: provide valid IANA timezone or valid lat/lon');
  err.code = 'CHART_TIMEZONE_UNRESOLVABLE';
  throw err;
}

module.exports = {
  resolveChartTimezoneForChartInsert,
  isValidIanaTimezone,
};
