/**
 * Persistence-shaped integrity: re-built canonical from the same inputs yields the same identity hash;
 * projection surfaces can be visited without mutating canonical truth (same core audio + claims).
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-persistence-integrity.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { fullPerceptualListenSummaryFromCore } from '../projection/rule-layer/audio-lexicon';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-persistence-integrity] ${msg}`);
}

function snap(): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 45 },
      { name: 'Mercury', lon: 60 },
      { name: 'Venus', lon: 75 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 120 },
      { name: 'Uranus', lon: 135 },
      { name: 'Neptune', lon: 150 },
      { name: 'Pluto', lon: 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function buildParams(seed: string) {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, seed);
  return {
    surface_kind: 'profile_natal' as const,
    subject_ids: ['pint'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'pint',
    compose_seed: seed,
    guidance: g,
  };
}

function claimSignature(core: ReturnType<typeof interpretCanonicalReportObject>): string {
  return core.claims.map((c) => `${c.claim_id}:${c.polarity}`).join('|');
}

function main(): void {
  const p1 = buildParams('pint-seed-a');
  const c1 = buildCanonicalReportForSnapshotSurface(p1);
  const h1 = c1.object_identity_hash;

  const core = interpretCanonicalReportObject(c1);
  const listenBefore = fullPerceptualListenSummaryFromCore(core);
  const claimsBefore = claimSignature(core);

  const seed = 'pint-proj';
  projectTextFromSemanticCore(core, seed, { phaseD: true, surface: 'profile', tier: 'baseline', narrativePlan: null });
  projectTextFromSemanticCore(core, seed, { phaseD: true, surface: 'campaign', tier: 'baseline', narrativePlan: null });
  projectTextFromSemanticCore(core, seed, { phaseD: true, surface: 'sandbox', tier: 'extended', narrativePlan: null });

  const p2 = buildParams('pint-seed-a');
  const c2 = buildCanonicalReportForSnapshotSurface(p2);
  assert(c2.object_identity_hash === h1, 're-built canonical must preserve object_identity_hash');

  const coreAfter = interpretCanonicalReportObject(c2);
  assert(claimsBefore === claimSignature(coreAfter), 'claim spine must match after canonical rebuild');
  assert(listenBefore === fullPerceptualListenSummaryFromCore(coreAfter), 'audio identity must match after canonical rebuild');

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, object_identity_hash: h1 }, null, 2));
}

main();
