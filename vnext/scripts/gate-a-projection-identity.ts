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
    ...extra,
  });
  const ids = sections.map((s) => s.id);
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

  const coreProfile = interpretCanonicalReportObject(
    buildCanonicalReportForSnapshotSurface({
      surface_kind: 'profile_natal',
      subject_ids: ['ga'],
      snapshot: natal,
      featureVec: fv,
      control_surface_hash: 'ga',
      compose_seed: 'ga',
      guidance: g,
    })
  );
  const coreDaily = interpretCanonicalReportObject(
    buildCanonicalReportForSnapshotSurface({
      surface_kind: 'home_daily',
      subject_ids: ['ga'],
      snapshot: natal,
      featureVec: fv,
      control_surface_hash: 'ga',
      compose_seed: 'ga',
      guidance: g,
    })
  );
  const coreOverlay = interpretCanonicalReportObject(
    buildCanonicalReportForOverlay({
      subject_ids: ['ov'],
      natalSnapshot: natal,
      natalFeatureVec: fv,
      transitSnapshot: transit,
      transitFeatureVec: fvt,
      control_surface_hash: 'ov',
      compose_seed: 'ov',
      guidance: g,
    })
  );
  const coreCompat = interpretCanonicalReportObject(
    buildCanonicalReportForAggregate({
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
    })
  );
  const coreGroup = interpretCanonicalReportObject(
    buildCanonicalReportForAggregate({
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
    })
  );

  const pBase = runSurface('profile', coreProfile, 'profile', 'baseline');
  assert((pBase.includes('aspects') || pBase.includes('signatures')) && pBase.includes('audio_staging'), 'profile baseline ids');

  const pExt = runSurface('profile', coreProfile, 'profile', 'extended');
  assert(pExt.includes('synthesis_a'), 'profile extended must include synthesis_a');
  assert(pExt.length > pBase.length, 'profile extended superset');

  const dExt = runSurface('daily', coreDaily, 'daily', 'extended');
  assert(dExt.includes('temporal_integration'), 'daily extended temporal_integration');

  const sExt = runSurface('sandbox', coreProfile, 'sandbox', 'extended');
  assert(sExt.includes('delta_emphasis'), 'sandbox extended delta_emphasis');

  const oExt = runSurface('overlay', coreOverlay, 'overlay_pair', 'extended');
  assert(oExt.includes('layering'), 'overlay_pair extended layering');

  const cBase = runSurface('compat', coreCompat, 'compat_pair', 'baseline', { connectionMode: 'lovers' });
  assert(cBase.includes('connection_structure') && cBase.includes('relational_field'), 'compat_pair baseline framing');

  const cExt = runSurface('compat', coreCompat, 'compat_pair', 'extended', { connectionMode: 'lovers' });
  assert(cExt.includes('interaction_map'), 'compat_pair extended interaction_map');

  const gBase = runSurface('group', coreGroup, 'group', 'baseline', {
    connectionMode: 'group',
    participantCount: 3,
  });
  assert(gBase.includes('ensemble_framing'), 'group baseline ensemble_framing');

  const gExt = runSurface('group', coreGroup, 'group', 'extended', {
    connectionMode: 'group',
    participantCount: 3,
  });
  assert(gExt.includes('field_distribution'), 'group extended field_distribution');

  const camp = runSurface('campaign', coreProfile, 'campaign', 'baseline');
  assert(camp.includes('signatures') && camp.includes('audio_staging'), 'campaign baseline');

  const feed = projectFeedCardFromSemanticCore(coreProfile, 'feed-ga');
  const feedIds = feed.map((s) => s.id);
  assert(feedIds.includes('feed_signal') && feedIds.includes('feed_context'), 'feed ids');
  const fPv = feed[feed.length - 1]?.meta?.projection_validation;
  assert(!!fPv?.ok, 'feed validation');

  console.log('[gate-a-projection-identity] OK');
}

main();
