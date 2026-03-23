/**
 * Build ChartInput for transit C(t) from calendar date, clock time, and canonical location.
 */

import type { ChartInput } from '../core/architecture-engine';

export type CanonicalLocationShape = {
  lat: number;
  lon: number;
  timezone: string;
};

export function buildTransitChartInput(params: {
  date: string;
  time: string;
  location: CanonicalLocationShape;
}): ChartInput {
  const { date, time, location } = params;
  const timeNorm = time.length === 5 ? time : time.slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format');
  }
  if (!/^\d{2}:\d{2}$/.test(timeNorm)) {
    throw new Error('Invalid time format');
  }
  if (!location.timezone || typeof location.timezone !== 'string') {
    throw new Error('timezone required');
  }
  return {
    date,
    time: timeNorm,
    lat: location.lat,
    lon: location.lon,
    timezone: location.timezone,
  };
}
