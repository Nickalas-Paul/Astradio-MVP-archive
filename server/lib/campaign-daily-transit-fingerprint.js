/**
 * Campaign-only transit context fingerprint for `campaign_daily_state` identity.
 * Keys: canonical location fields + calendar_date only (no clock time).
 * Do not use for Profile, Sandbox, or other surfaces — those use `lib/canonical-location` transitContextFingerprint.
 */

const { canonicalJson, sha256 } = require('./canonical-location');

/**
 * @param {{ source: string, label: string, lat: number, lon: number, timezone: string, resolvedAt: string }} location
 * @param {string} calendarDate YYYY-MM-DD
 */
function campaignDailyTransitContextFingerprint(location, calendarDate) {
  const ctx = {
    source: location.source,
    label: location.label,
    lat: location.lat,
    lon: location.lon,
    timezone: location.timezone,
    resolvedAt: location.resolvedAt,
  };
  return sha256(canonicalJson({ context: ctx, date: calendarDate }));
}

module.exports = { campaignDailyTransitContextFingerprint };
