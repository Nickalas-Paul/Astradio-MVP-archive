/**
 * T2: Alignment sanity script.
 * Prints payload.hash, featureHash, planHash, template_id, dominant planets, element blend.
 * Does not change runtime routes; script only. In-process with mocked chart-snapshot.
 */

import { ComposeAPI } from '../api/compose';
import type { EphemerisSnapshot } from '../contracts';
import { computePlanHash } from '../plan-hash';
import { encodeFeatures } from '../feature-encode';
import { astroSummaryFromSnapshot } from '../explainer/astro-summary-from-snapshot';

const FIXED_DATE = '2025-01-15';
const FIXED_TIME = '12:00';
const FIXED_LAT = 40.7128;
const FIXED_LON = -74.006;

function makeFixedSnapshot(): EphemerisSnapshot {
  const planets = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'
  ].map((name, i) => ({ name, lon: (i * 37) % 360 }));
  const houses: [number, number, number, number, number, number, number, number, number, number, number, number] = [
    0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330
  ];
  return {
    ts: `${FIXED_DATE}T${FIXED_TIME}:00Z`,
    tz: 'UTC',
    lat: FIXED_LAT,
    lon: FIXED_LON,
    houseSystem: 'placidus',
    planets,
    houses,
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
  };
}

async function main(): Promise<void> {
  const fixedSnapshot = makeFixedSnapshot();
  (global as any).fetch = async (url: string | URL): Promise<Response> => {
    const u = String(url);
    if (u.includes('chart-snapshot')) {
      return { ok: true, json: async () => fixedSnapshot } as Response;
    }
    throw new Error('Unexpected fetch: ' + u);
  };

  const api = new ComposeAPI();
  const request = {
    mode: 'sky' as const,
    skyParams: {
      latitude: FIXED_LAT,
      longitude: FIXED_LON,
      datetime: `${FIXED_DATE}T${FIXED_TIME}:00`
    }
  };

  const res = await api.compose(request) as any;
  const payload = res?.controls;
  const text = res?.text;
  const plan = res?.plan;

  const payloadHash = payload?.hash ?? '—';
  const featureHash = res?.hashes?.control ?? '—';
  const planHash = plan ? computePlanHash(plan) : '—';
  const templateId = (res?.explanation as any)?.template_id ?? text?.template_id ?? '—';

  const featureVec = encodeFeatures(fixedSnapshot);
  const astroSummary = astroSummaryFromSnapshot(fixedSnapshot, featureVec, payload?.modality);
  const elementBlend = `fire=${astroSummary.elements.fire.toFixed(2)} earth=${astroSummary.elements.earth.toFixed(2)} air=${astroSummary.elements.air.toFixed(2)} water=${astroSummary.elements.water.toFixed(2)}`;
  const dominantPlanetsStr = astroSummary.dominant_planets.length
    ? astroSummary.dominant_planets.join(', ')
    : '(none)';

  console.log('payload.hash:', payloadHash);
  console.log('featureHash (control):', featureHash);
  console.log('planHash:', planHash);
  console.log('template_id:', templateId);
  console.log('element blend:', elementBlend);
  console.log('dominant planets:', dominantPlanetsStr);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
