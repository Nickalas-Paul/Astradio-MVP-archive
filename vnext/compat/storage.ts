/**
 * Community Compatibility V1 — minimal in-memory persistence.
 * TODO: Replace with existing DB layer when available (e.g. lib/database).
 */

import type { User, Chart, Comparison } from './types';

const nanoid = () =>
  require('crypto').randomBytes(8).toString('hex');

const now = () => new Date().toISOString();

const users = new Map<string, User>();
const charts = new Map<string, Chart>();
const comparisons = new Map<string, Comparison>();

/** Fixed id for V1 stub "primary chart" (deterministic). */
export const DEFAULT_PROFILE_CHART_ID = 'chart_profile_default';

export function createUser(input: { displayName: string; email?: string }): User {
  const id = `usr_${nanoid()}`;
  const user: User = {
    id,
    displayName: input.displayName,
    email: input.email,
    createdAt: now(),
    updatedAt: now(),
  };
  users.set(id, user);
  return user;
}

export function getUser(id: string): User | undefined {
  return users.get(id);
}

export function createChart(input: {
  ownerId?: string;
  label: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
  snapshotHash?: string;
}): Chart {
  const id = `chart_${nanoid()}`;
  const chart: Chart = {
    id,
    ownerId: input.ownerId,
    label: input.label,
    date: input.date,
    time: input.time,
    lat: input.lat,
    lon: input.lon,
    timezone: input.timezone,
    snapshotHash: input.snapshotHash,
    createdAt: now(),
    updatedAt: now(),
  };
  charts.set(id, chart);
  return chart;
}

export function getChart(id: string): Chart | undefined {
  return charts.get(id);
}

export function listChartsByOwner(ownerId: string): Chart[] {
  return Array.from(charts.values()).filter((c) => c.ownerId === ownerId);
}

export function createComparison(input: Omit<Comparison, 'id' | 'createdAt'>): Comparison {
  const id = `cmp_${nanoid()}`;
  const comparison: Comparison = {
    ...input,
    id,
    createdAt: now(),
  };
  comparisons.set(id, comparison);
  return comparison;
}

export function getComparison(id: string): Comparison | undefined {
  return comparisons.get(id);
}

/**
 * Ensure the default profile chart exists (V1 stub). Deterministic so same chart every time.
 * Call once when serving profile/chart or compat routes.
 */
export function ensureDefaultProfileChart(): Chart {
  let chart = charts.get(DEFAULT_PROFILE_CHART_ID);
  if (chart) return chart;
  chart = {
    id: DEFAULT_PROFILE_CHART_ID,
    ownerId: undefined,
    label: 'My Natal',
    date: '1990-01-15',
    time: '12:00',
    lat: 40.7128,
    lon: -74.006,
    timezone: undefined,
    snapshotHash: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  charts.set(DEFAULT_PROFILE_CHART_ID, chart);
  return chart;
}

/** Deterministic match candidate chart ids (V1). Same order and data every time. */
const MATCH_CANDIDATE_SPECS: Array<{ id: string; userId: string; displayName: string; label: string; date: string; time: string; lat: number; lon: number }> = [
  { id: 'chart_match_1', userId: 'usr_demo_1', displayName: 'Demo User 1', label: 'Natal 1', date: '1985-06-10', time: '14:30', lat: 51.5074, lon: -0.1278 },
  { id: 'chart_match_2', userId: 'usr_demo_2', displayName: 'Demo User 2', label: 'Natal 2', date: '1992-11-22', time: '08:00', lat: 40.7128, lon: -74.006 },
  { id: 'chart_match_3', userId: 'usr_demo_3', displayName: 'Demo User 3', label: 'Natal 3', date: '1988-03-05', time: '18:45', lat: 34.0522, lon: -118.2437 },
  { id: 'chart_match_4', userId: 'usr_demo_4', displayName: 'Demo User 4', label: 'Natal 4', date: '1995-09-14', time: '12:00', lat: 41.8781, lon: -87.6298 },
  { id: 'chart_match_5', userId: 'usr_demo_5', displayName: 'Demo User 5', label: 'Natal 5', date: '1990-01-15', time: '06:00', lat: 37.7749, lon: -122.4194 },
];

export interface MatchCandidate {
  chartId: string;
  userId: string;
  displayName: string;
}

/**
 * Ensure match candidate charts exist and return list (deterministic). Used by GET /api/compat/matches.
 */
export function ensureMatchCandidateCharts(): MatchCandidate[] {
  const out: MatchCandidate[] = [];
  for (const spec of MATCH_CANDIDATE_SPECS) {
    if (!charts.has(spec.id)) {
      const chart: Chart = {
        id: spec.id,
        ownerId: spec.userId,
        label: spec.label,
        date: spec.date,
        time: spec.time,
        lat: spec.lat,
        lon: spec.lon,
        timezone: undefined,
        snapshotHash: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      charts.set(spec.id, chart);
    }
    out.push({ chartId: spec.id, userId: spec.userId, displayName: spec.displayName });
  }
  return out;
}
