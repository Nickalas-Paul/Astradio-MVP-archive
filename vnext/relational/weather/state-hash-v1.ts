/**
 * Stage 7 v1 — Deterministic stateHash from inputs (not derived scores).
 */

import * as crypto from 'crypto';
import type { EphemerisSnapshot } from '../../contracts';
import { RW_V1_ASPECT_CONFIG_ID, RW_V1_GROUP_COMPOSE_ALG } from './constants-v1';

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeRelationalWeatherStateHashV1(input: {
  version: 'relational_weather_v1';
  chartIdsOrdered: string[];
  vectorHashes: Record<string, string>;
  transit: EphemerisSnapshot;
}): string {
  const sortedHashes: Record<string, string> = {};
  for (const id of [...input.chartIdsOrdered].sort((a, b) => a.localeCompare(b, 'en'))) {
    sortedHashes[id] = input.vectorHashes[id] ?? '';
  }
  const payload = {
    version: input.version,
    aspect_config_id: RW_V1_ASPECT_CONFIG_ID,
    group_compose_algorithm: RW_V1_GROUP_COMPOSE_ALG,
    chart_ids: input.chartIdsOrdered,
    vector_hashes: sortedHashes,
    transit: {
      ts: input.transit.ts,
      tz: input.transit.tz,
      lat: input.transit.lat,
      lon: input.transit.lon,
      houseSystem: input.transit.houseSystem,
    },
  };
  return crypto.createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}
