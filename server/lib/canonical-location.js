/**
 * CanonicalLocation validation — aligned with apps/web/app/api/compose/route.ts (sky client schema).
 * No silent fallbacks.
 */

const crypto = require('crypto');

const ALLOWED_SOURCES = new Set(['browser_geo', 'geofinder']);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, location: object } | { ok: false, error: string, code?: string }}
 */
function validateCanonicalLocation(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'location required', code: 'LOCATION_REQUIRED' };
  }
  const source = String(body.source || '').trim();
  const label = String(body.label || '').trim();
  const lat = body.lat;
  const lon = body.lon;
  const timezone = String(body.timezone || '').trim();
  const resolvedAt = String(body.resolvedAt || '').trim();

  if (!ALLOWED_SOURCES.has(source)) {
    return { ok: false, error: 'Invalid location source', code: 'INVALID_SOURCE' };
  }
  if (!label || label.length > 300) {
    return { ok: false, error: 'Invalid label', code: 'INVALID_LABEL' };
  }
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Invalid lat/lon', code: 'INVALID_COORDS' };
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false, error: 'lat/lon out of range', code: 'INVALID_COORDS' };
  }
  if (!timezone || timezone.length > 100) {
    return { ok: false, error: 'timezone required', code: 'INVALID_TIMEZONE' };
  }
  if (!resolvedAt || resolvedAt.length > 100) {
    return { ok: false, error: 'resolvedAt required', code: 'INVALID_RESOLVED_AT' };
  }

  const location = { source, label, lat, lon, timezone, resolvedAt };
  return { ok: true, location };
}

/** Fingerprint for solo conflict checks and persistence. */
function transitContextFingerprint(location, date, time) {
  const ctx = {
    source: location.source,
    label: location.label,
    lat: location.lat,
    lon: location.lon,
    timezone: location.timezone,
    resolvedAt: location.resolvedAt,
  };
  return sha256(canonicalJson({ context: ctx, date, time }));
}

/** Fingerprint of stored context only (for user_transit_context row). */
function userTransitContextRowFingerprint(location) {
  const ctx = {
    source: location.source,
    label: location.label,
    lat: location.lat,
    lon: location.lon,
    timezone: location.timezone,
    resolvedAt: location.resolvedAt,
  };
  return sha256(canonicalJson({ context: ctx }));
}

module.exports = {
  validateCanonicalLocation,
  transitContextFingerprint,
  userTransitContextRowFingerprint,
  canonicalJson,
  sha256,
};
