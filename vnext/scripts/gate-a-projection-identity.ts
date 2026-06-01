/**
 * Gate A — structural identity checks for Phase D surfaces (ids + expansion keys), not copy QA.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/gate-a-projection-identity.js
 */
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import {
  buildCanonicalReportForSnapshotSurface,
  buildCanonicalReportForAggregate,
  buildCanonicalReportForOverlay,
} from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore, projectFeedCardFromSemanticCore } from '../projection/text-projection';
import { insightProjectionOptionsFromCanonical } from '../projection/insight-projection-from-canonical';
import type { CanonicalReportObject } from '../canonical/canonical-report-object';
import { mergeFeatureVectors } from '../compat/fusion';
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import type { ExpansionTier } from '../projection/projection-types';
import type { ProjectionSurface } from '../projection/projection-types';

function snap(d = 0): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128 + d,
    lon: -74.006 + d,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 + d },
      { name: 'Moon', lon: 45 + d },
      { name: 'Mercury', lon: 60 + d },
      { name: 'Venus', lon: 75 + d },
      { name: 'Mars', lon: 90 + d },
      { name: 'Jupiter', lon: 105 + d },
      { name: 'Saturn', lon: 120 + d },
      { name: 'Uranus', lon: 135 + d },
      { name: 'Neptune', lon: 150 + d },
      { name: 'Pluto', lon: 165 + d },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[gate-a-projection-identity] ${msg}`);
}

function runSurface(
  label: string,
  core: ReturnType<typeof interpretCanonicalReportObject>,
  canonical: CanonicalReportObject,
  surface: ProjectionSurface,
  tier: ExpansionTier,
  extra: Record<string, unknown> = {}
) {
  const sections = projectTextFromSemanticCore(core, 'gate-a-seed', {
    phaseD: true,
    surface,
    tier,
    narrativePlan: null,
    aspectTension: null,
    ...insightProjectionOptionsFromCanonical(canonical),
    ...extra,
  });
  const ids = sections.map((s) => s.id);
  if (sections.length === 0) return ids;
  const pv = sections[sections.length - 1]?.meta?.projection_validation;
  assert(!!pv, `${label}: missing projection_validation`);
  assert(pv!.tierRequested === tier, `${label}: tierRequested mismatch`);
  assert(pv!.tierEffective === tier, `${label}: tierEffective mismatch`);
  assert(pv!.ok === true, `${label}: validation not ok: ${pv!.violations.join(';')}`);
  return ids;
}

function main(): void {
  const natal = snap(0);
  const natal2 = snap(5);
  const natal3 = snap(11);
  const transit = snap(10);
  const fv = encodeFeatures(natal) as FeatureVec;
  const fv2 = encodeFeatures(natal2) as FeatureVec;
  const fv3 = encodeFeatures(natal3) as FeatureVec;
  const fvt = encodeFeatures(transit) as FeatureVec;
  const g = guidanceFromFeatures(fv, natal, 'ga');
  const merged = mergeFeatureVectors(fv, fv2, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 });
  const m12 = mergeFeatureVectors(fv, fv2, { relationshipMode: 'neutral', wA: 0.5, wB: 0.5 });
  const merged3 = mergeFeatureVectors(m12, fv3, { relationshipMode: 'neutral', wA: 0.67, wB: 0.33 });

  const canonicalProfile = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['ga'],
    snapshot: natal,
    featureVec: fv,
    control_surface_hash: 'ga',
    compose_seed: 'ga',
    guidance: g,
  });
  const coreProfile = interpretCanonicalReportObject(canonicalProfile);
  const canonicalDaily = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'home_daily',
    subject_ids: ['ga'],
    snapshot: natal,
    featureVec: fv,
    control_surface_hash: 'ga',
    compose_seed: 'ga',
    guidance: g,
  });
  const coreDaily = interpretCanonicalReportObject(canonicalDaily);
  const canonicalOverlay = buildCanonicalReportForOverlay({
      subject_ids: ['ov'],
      natalSnapshot: natal,
      natalFeatureVec: fv,
      transitSnapshot: transit,
      transitFeatureVec: fvt,
      control_surface_hash: 'ov',
      compose_seed: 'ov',
      guidance: g,
    });
  const coreOverlay = interpretCanonicalReportObject(canonicalOverlay);
  const canonicalCompat = buildCanonicalReportForAggregate({
      kind: 'comparison',
      subject_ids: ['c'],
      participants: [
        { snapshot: natal, featureVec: fv, role: 'primary' },
        { snapshot: natal2, featureVec: fv2, role: 'member_i' },
      ],
      composite: merged as FeatureVec,
      anchorIndex: 0,
      control_surface_hash: 'c',
      compose_seed: 'c',
      guidance: g,
      relationalWeather: null,
    });
  const coreCompat = interpretCanonicalReportObject(canonicalCompat);
  const canonicalGroup = buildCanonicalReportForAggregate({
      kind: 'group',
      subject_ids: ['gr'],
      participants: [
        { snapshot: natal, featureVec: fv, role: 'primary' },
        { snapshot: natal2, featureVec: fv2, role: 'member_i' },
        { snapshot: natal3, featureVec: fv3, role: 'member_i' },
      ],
      composite: merged3 as FeatureVec,
      anchorIndex: 0,
      control_surface_hash: 'gr',
      compose_seed: 'gr',
      guidance: g,
      relationalWeather: null,
    });
  const coreGroup = interpretCanonicalReportObject(canonicalGroup);

  const pBase = runSurface('profile', coreProfile, canonicalProfile, 'profile', 'baseline');
  assert(
    pBase.includes('aspects') || pBase.includes('signatures') || pBase.includes('core_identity'),
    'profile baseline ids'
  );
  assert(!pBase.includes('audio_staging') && !pBase.includes('musical'), 'profile baseline: no removed listen sections');

  const pExt = runSurface('profile', coreProfile, canonicalProfile, 'profile', 'extended');
  assert(pExt.includes('core_identity'), 'profile extended identity placements');
  assert(!pExt.includes('audio_staging') && !pExt.includes('musical'), 'profile extended: no removed listen sections');

  const dExt = runSurface('daily', coreDaily, canonicalDaily, 'daily', 'extended');
  assert(dExt.includes('todays_sound') || dExt.includes('sky_anchor'), 'daily extended home sky');

  const sExt = runSurface('sandbox', coreProfile, canonicalProfile, 'sandbox', 'extended');
  assert(!sExt.includes('audio_staging') && !sExt.includes('musical'), 'sandbox: no removed listen sections');

  const oExt = runSurface('overlay', coreOverlay, canonicalOverlay, 'overlay_pair', 'extended');
  assert(oExt.includes('no_activations'), 'overlay_pair extended activation section');

  const cBase = runSurface('compat', coreCompat, canonicalCompat, 'compat_pair', 'baseline', { connectionMode: 'lovers' });
  assert(!cBase.includes('audio_staging') && !cBase.includes('musical'), 'compat_pair baseline: no removed listen sections');

  const cExt = runSurface('compat', coreCompat, canonicalCompat, 'compat_pair', 'extended', { connectionMode: 'lovers' });
  assert(!cExt.includes('audio_staging') && !cExt.includes('musical'), 'compat_pair extended: no removed listen sections');

  const gBase = runSurface('group', coreGroup, canonicalGroup, 'group', 'baseline', {
    connectionMode: 'group',
    participantCount: 3,
  });
  assert(!gBase.includes('audio_staging') && !gBase.includes('musical'), 'group baseline: no removed listen sections');

  const gExt = runSurface('group', coreGroup, canonicalGroup, 'group', 'extended', {
    connectionMode: 'group',
    participantCount: 3,
  });
  assert(!gExt.includes('audio_staging') && !gExt.includes('musical'), 'group extended: no removed listen sections');

  const camp = runSurface('campaign', coreProfile, canonicalProfile, 'campaign', 'baseline');
  assert(!camp.includes('audio_staging') && !camp.includes('musical'), 'campaign baseline: no removed listen sections');

  const feed = projectFeedCardFromSemanticCore(coreProfile, 'feed-ga', {
    ...insightProjectionOptionsFromCanonical(canonicalProfile),
  });
  const feedIds = feed.map((s) => s.id);
  assert(!feedIds.includes('audio_staging') && !feedIds.includes('musical'), 'feed: no removed listen sections');
  if (feed.length > 0) {
    assert(feedIds.includes('feed_signal') || feedIds.includes('feed_context'), 'feed ids when present');
    const fPv = feed[feed.length - 1]?.meta?.projection_validation;
    assert(!!fPv?.ok, 'feed validation');
  }

  console.log('[gate-a-projection-identity] OK');
}

main();
