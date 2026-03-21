/**
 * Phase B — deterministic plan chart context reduction for aggregate composition.
 * Locked rules: comparison (two snapshots) and group (N snapshots ordered by chart_id).
 */

import type { EphemerisSnapshot } from '../contracts';
import type { ControlSurfacePayload } from '../explainer/contracts';

const ELEMENT_KEYS = ['fire', 'earth', 'air', 'water'] as const;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function defaultHouses(): EphemerisSnapshot['houses'] {
  return Array.from({ length: 12 }, (_, i) => i * 30) as EphemerisSnapshot['houses'];
}

function pickHouses12(snap: EphemerisSnapshot): EphemerisSnapshot['houses'] {
  const h = snap.houses;
  if (Array.isArray(h) && h.length === 12) return h as EphemerisSnapshot['houses'];
  return defaultHouses();
}

/** Comparison: chartIdLow = min(A,B), chartIdHigh = max(A,B); snapLow/snapHigh aligned to ids. */
export function buildComparisonPlanChartContext(
  controlPayload: ControlSurfacePayload,
  snapLow: EphemerisSnapshot,
  snapHigh: EphemerisSnapshot
): Record<string, unknown> {
  const reduction: Record<string, unknown> = {};

  reduction.ts = snapLow.ts;

  const tzLow = typeof snapLow.tz === 'string' && snapLow.tz.trim() ? snapLow.tz : '';
  const tzHigh = typeof snapHigh.tz === 'string' && snapHigh.tz.trim() ? snapHigh.tz : '';
  reduction.tz = tzLow || tzHigh || 'UTC';

  const latL = snapLow.lat;
  const latH = snapHigh.lat;
  const latFiniteL = typeof latL === 'number' && Number.isFinite(latL);
  const latFiniteH = typeof latH === 'number' && Number.isFinite(latH);
  if (latFiniteL && latFiniteH) reduction.lat = (latL + latH) / 2;
  else if (latFiniteL) reduction.lat = latL;
  else if (latFiniteH) reduction.lat = latH;
  else reduction.lat = 0;

  const lonL = snapLow.lon;
  const lonH = snapHigh.lon;
  const lonFiniteL = typeof lonL === 'number' && Number.isFinite(lonL);
  const lonFiniteH = typeof lonH === 'number' && Number.isFinite(lonH);
  if (lonFiniteL && lonFiniteH) reduction.lon = (lonL + lonH) / 2;
  else if (lonFiniteL) reduction.lon = lonL;
  else if (lonFiniteH) reduction.lon = lonH;
  else reduction.lon = 0;

  const hsL = snapLow.houseSystem;
  const hsH = snapHigh.houseSystem;
  reduction.houseSystem =
    typeof hsL === 'string' && typeof hsH === 'string' && hsL === hsH ? hsL : 'placidus';

  const m = (s: EphemerisSnapshot) =>
    typeof s.moonPhase === 'number' && Number.isFinite(s.moonPhase) ? clamp01(s.moonPhase) : 0.5;
  reduction.moonPhase = clamp01((m(snapLow) + m(snapHigh)) / 2);

  const raw: Record<string, number> = {};
  for (const k of ELEMENT_KEYS) {
    const vL =
      snapLow.dominantElements && typeof snapLow.dominantElements[k] === 'number'
        ? snapLow.dominantElements[k]
        : 0.25;
    const vH =
      snapHigh.dominantElements && typeof snapHigh.dominantElements[k] === 'number'
        ? snapHigh.dominantElements[k]
        : 0.25;
    raw[k] = clamp01((vL + vH) / 2);
  }
  const sum = ELEMENT_KEYS.reduce((a, k) => a + raw[k], 0);
  if (sum > 0) {
    reduction.dominantElements = {
      fire: raw.fire / sum,
      earth: raw.earth / sum,
      air: raw.air / sum,
      water: raw.water / sum,
    };
  } else {
    reduction.dominantElements = { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 };
  }

  const nameSet = new Set<string>();
  for (const p of snapLow.planets || []) {
    if (p && typeof p.name === 'string') nameSet.add(p.name);
  }
  for (const p of snapHigh.planets || []) {
    if (p && typeof p.name === 'string') nameSet.add(p.name);
  }
  const names = Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'en'));
  const planetsOut: Array<{ name: string; lon: number }> = [];
  for (const name of names) {
    const lonLow = snapLow.planets?.find((p) => p.name === name)?.lon;
    const lonHigh = snapHigh.planets?.find((p) => p.name === name)?.lon;
    const fL = typeof lonLow === 'number' && Number.isFinite(lonLow);
    const fH = typeof lonHigh === 'number' && Number.isFinite(lonHigh);
    if (fL && fH) planetsOut.push({ name, lon: (lonLow + lonHigh) / 2 });
    else if (fL) planetsOut.push({ name, lon: lonLow });
    else if (fH) planetsOut.push({ name, lon: lonHigh });
  }
  reduction.planets = planetsOut;

  if (Array.isArray(snapLow.houses) && snapLow.houses.length === 12) {
    reduction.houses = snapLow.houses;
  } else if (Array.isArray(snapHigh.houses) && snapHigh.houses.length === 12) {
    reduction.houses = snapHigh.houses;
  } else {
    reduction.houses = defaultHouses();
  }

  if (Array.isArray(snapLow.aspects) && snapLow.aspects.length > 0) {
    reduction.aspects = snapLow.aspects;
  } else if (Array.isArray(snapHigh.aspects) && snapHigh.aspects.length > 0) {
    reduction.aspects = snapHigh.aspects;
  } else {
    reduction.aspects = [];
  }

  return { ...controlPayload, ...reduction };
}

/** Group: snapshotsOrdered sorted by chart_id ascending. */
export function buildGroupPlanChartContext(
  controlPayload: ControlSurfacePayload,
  snapshotsOrdered: EphemerisSnapshot[]
): Record<string, unknown> {
  const snaps = snapshotsOrdered;
  const N = snaps.length;
  const reduction: Record<string, unknown> = {};

  if (N === 0) {
    return { ...controlPayload, ...reduction };
  }

  reduction.ts = snaps[0].ts;

  let tz = 'UTC';
  for (let i = 0; i < N; i++) {
    const t = snaps[i].tz;
    if (typeof t === 'string' && t.trim()) {
      tz = t;
      break;
    }
  }
  reduction.tz = tz;

  let latSum = 0;
  let latN = 0;
  let lonSum = 0;
  let lonN = 0;
  for (let i = 0; i < N; i++) {
    const la = snaps[i].lat;
    const lo = snaps[i].lon;
    if (typeof la === 'number' && Number.isFinite(la)) {
      latSum += la;
      latN++;
    }
    if (typeof lo === 'number' && Number.isFinite(lo)) {
      lonSum += lo;
      lonN++;
    }
  }
  reduction.lat = latN > 0 ? latSum / latN : 0;
  reduction.lon = lonN > 0 ? lonSum / lonN : 0;

  const firstHs = snaps[0].houseSystem;
  let unanimous =
    typeof firstHs === 'string' &&
    snaps.every((s) => typeof s.houseSystem === 'string' && s.houseSystem === firstHs);
  reduction.houseSystem = unanimous ? firstHs : 'placidus';

  let moonSum = 0;
  for (let i = 0; i < N; i++) {
    const mp = snaps[i].moonPhase;
    moonSum +=
      typeof mp === 'number' && Number.isFinite(mp) ? clamp01(mp) : 0.5;
  }
  reduction.moonPhase = clamp01(moonSum / N);

  const raw: Record<string, number> = {};
  for (const k of ELEMENT_KEYS) {
    let s = 0;
    for (let i = 0; i < N; i++) {
      const v =
        snaps[i].dominantElements && typeof snaps[i].dominantElements[k] === 'number'
          ? snaps[i].dominantElements[k]
          : 0.25;
      s += v;
    }
    raw[k] = clamp01(s / N);
  }
  const sum = ELEMENT_KEYS.reduce((a, k) => a + raw[k], 0);
  if (sum > 0) {
    reduction.dominantElements = {
      fire: raw.fire / sum,
      earth: raw.earth / sum,
      air: raw.air / sum,
      water: raw.water / sum,
    };
  } else {
    reduction.dominantElements = { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 };
  }

  const nameSet = new Set<string>();
  for (let i = 0; i < N; i++) {
    for (const p of snaps[i].planets || []) {
      if (p && typeof p.name === 'string') nameSet.add(p.name);
    }
  }
  const names = Array.from(nameSet).sort((a, b) => a.localeCompare(b, 'en'));
  const planetsOut: Array<{ name: string; lon: number }> = [];
  for (const name of names) {
    let sumLon = 0;
    let count = 0;
    for (let i = 0; i < N; i++) {
      const lon = snaps[i].planets?.find((p) => p.name === name)?.lon;
      if (typeof lon === 'number' && Number.isFinite(lon)) {
        sumLon += lon;
        count++;
      }
    }
    if (count > 0) planetsOut.push({ name, lon: sumLon / count });
  }
  reduction.planets = planetsOut;

  let housesPicked: EphemerisSnapshot['houses'] | null = null;
  for (let i = 0; i < N; i++) {
    if (Array.isArray(snaps[i].houses) && snaps[i].houses.length === 12) {
      housesPicked = snaps[i].houses as EphemerisSnapshot['houses'];
      break;
    }
  }
  reduction.houses = housesPicked ?? defaultHouses();

  let aspectsPicked: EphemerisSnapshot['aspects'] = [];
  for (let i = 0; i < N; i++) {
    if (Array.isArray(snaps[i].aspects) && snaps[i].aspects.length > 0) {
      aspectsPicked = snaps[i].aspects;
      break;
    }
  }
  reduction.aspects = aspectsPicked;

  return { ...controlPayload, ...reduction };
}
