/**
 * Chart field exposure: full birth data for own profile; public-safe subset for others.
 */

import type { Chart } from './types';

export type PublicPrimaryChartPayload = {
  id: string;
  label: string;
  date: string;
};

export type OwnPrimaryChartPayload = {
  id: string;
  label: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
};

export function publicPrimaryChartPayload(chart: Chart | null | undefined): PublicPrimaryChartPayload | null {
  if (!chart) return null;
  return {
    id: chart.id,
    label: chart.label,
    date: chart.date,
  };
}

export function ownPrimaryChartPayload(chart: Chart): OwnPrimaryChartPayload {
  return {
    id: chart.id,
    label: chart.label,
    date: chart.date,
    time: chart.time,
    lat: chart.lat,
    lon: chart.lon,
    ...(chart.timezone !== undefined ? { timezone: chart.timezone } : {}),
  };
}

/** Strip sensitive birth fields from a chart object for API responses about other users. */
export function chartPayloadForPublicView<T extends Record<string, unknown>>(chart: T): T {
  const out = { ...chart };
  delete out.time;
  delete out.lat;
  delete out.lon;
  delete out.timezone;
  return out;
}
