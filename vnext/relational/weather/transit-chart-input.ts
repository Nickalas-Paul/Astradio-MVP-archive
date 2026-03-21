/**
 * Parse explicit transit query params into ChartInput for fetchChartSnapshot.
 * Fail-closed: throws on missing/invalid fields (no implicit "now").
 */

import type { ChartInput } from '../../core/architecture-engine';

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?Z$/;

function parseIsoToDateTime(iso: string): { date: string; time: string } {
  const s = String(iso).trim();
  if (!ISO_Z.test(s)) {
    throw new Error('transitDatetime must be ISO 8601 UTC with Z suffix, e.g. 2025-03-21T14:30:00Z');
  }
  const date = s.slice(0, 10);
  const timePart = s.slice(11, 16);
  return { date, time: timePart };
}

export function transitParamsToChartInput(params: {
  transitDatetime: string;
  transitLatitude: number;
  transitLongitude: number;
  transitTimezone?: string;
}): ChartInput {
  const { date, time } = parseIsoToDateTime(params.transitDatetime);
  const lat = Number(params.transitLatitude);
  const lon = Number(params.transitLongitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('transitLatitude invalid');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('transitLongitude invalid');
  }
  const timezone = (params.transitTimezone && String(params.transitTimezone).trim()) || 'UTC';
  return { date, time, lat, lon, timezone };
}
