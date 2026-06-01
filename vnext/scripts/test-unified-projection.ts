/**
 * Unified projection smoke: determinism + campaign copy policy.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-unified-projection.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectFeedCardFromSemanticCore, projectTextFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ProjectedExplanationSection } from '../projection/projection-types';

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

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-unified-projection] ${msg}`);
}

/** User-facing projection copy must never contain internal / system vocabulary (fail CI). */
const BLACKLIST: RegExp[] = [
  /\bencoded\b/i,
  /\bencoding\b/i,
  /\bfeature field\b/i,
  /\benvelope\b/i,
  /\barc bias\b/i,
  /\bstaging\b/i,
  /\bsemantic source\b/i,
  /\bSemanticCore\b/,
  /\bthis readout\b/i,
  /\bsemantic field\b/i,
  /\breadout\b/i,
  /\bTENSION_BAND_/,
  /\bTENSION_BUCKET_/,
  /\bAUDIO_TENSION_/,
  /\bAUDIO_/,
  /\bMOTION_LABEL_/,
  /\bREL_BAND_/,
  /\bHARMONY_BUCKET_/,
];

function allVisibleText(sections: ProjectedExplanationSection[]): string {
  return sections
    .map((s) => [s.title, s.text, ...(s.bullets ?? [])].join('\n'))
    .join('\n');
}

function assertNoBlacklist(text: string, label: string): void {
  for (const re of BLACKLIST) {
    assert(!re.test(text), `${label}: forbidden pattern ${re.source}`);
  }
}

function allReferencedClaimIds(sections: ProjectedExplanationSection[]): Set<string> {
  const out = new Set<string>();
  for (const s of sections) {
    for (const id of s.meta?.claimIdsReferenced ?? []) out.add(id);
  }
  return out;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function main(): void {
  const n = snap();
  const fv = encodeFeatures(n) as FeatureVec;
  const g = guidanceFromFeatures(fv, n, 'uproj');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['test-hash'],
    snapshot: n,
    featureVec: fv,
    control_surface_hash: 'ctrl',
    compose_seed: 'seed',
    guidance: g,
  });
  const core = interpretCanonicalReportObject(canonical);
  const insightOpts = insightProjectionOptionsFromCanonical(canonical);

  const a = projectTextFromSemanticCore(core, 'det-seed', {
    phaseD: true,
    surface: 'profile',
    tier: 'baseline',
    narrativePlan: null,
    ...insightOpts,
  });
  const b = projectTextFromSemanticCore(core, 'det-seed', {
    phaseD: true,
    surface: 'profile',
    tier: 'baseline',
    narrativePlan: null,
    ...insightOpts,
  });
  assert(JSON.stringify(a) === JSON.stringify(b), 'determinism: two runs must match');

  const refsSeedA = allReferencedClaimIds(
    projectTextFromSemanticCore(core, 'vary-seed-a', {
      phaseD: true,
      surface: 'profile',
      tier: 'extended',
      narrativePlan: null,
      ...insightOpts,
    })
  );
  const refsSeedB = allReferencedClaimIds(
    projectTextFromSemanticCore(core, 'vary-seed-b', {
      phaseD: true,
      surface: 'profile',
      tier: 'extended',
      narrativePlan: null,
      ...insightOpts,
    })
  );
  assert(setsEqual(refsSeedA, refsSeedB), 'different projection seeds must not add/remove referenced claims');

  assertNoBlacklist(allVisibleText(a), 'profile baseline');

  const camp = projectTextFromSemanticCore(core, 'camp-seed', {
    phaseD: true,
    surface: 'campaign',
    tier: 'baseline',
    narrativePlan: null,
    ...insightOpts,
  });
  const campText = camp.map((s) => `${s.title}\n${s.text}`).join('\n');
  assert(
    !campText.includes('In this scenario, you see a stable'),
    'campaign baseline: no legacy stable scenario opener'
  );
  assert(
    !campText.includes('In this scenario, you see a calmer'),
    'campaign baseline: no legacy calmer scenario opener'
  );
  assert(!campText.includes('story beat'), 'campaign baseline: no legacy story-beat opener fragment');
  assert(!campText.includes('TENSION_BAND_'), 'campaign: no raw tension band ids in visible text');
  assert(!campText.includes('MOTION_LABEL_'), 'campaign: no raw motion label ids in visible text');
  const astroTitles = camp.filter((s) => /astrological/i.test(s.title));
  assert(astroTitles.length === 0, 'campaign: no astrology-facing section titles');
  assertNoBlacklist(campText + camp.map((s) => (s.bullets ?? []).join('\n')).join('\n'), 'campaign');

  const feed = projectFeedCardFromSemanticCore(core, 'feed-seed');
  assertNoBlacklist(allVisibleText(feed), 'feed');

  console.log('[test-unified-projection] OK');
}

main();
