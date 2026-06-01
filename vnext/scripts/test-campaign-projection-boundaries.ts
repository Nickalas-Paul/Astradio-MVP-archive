#!/usr/bin/env node
/**
 * Campaign projection boundary verification:
 * - unified projection `surface: campaign` is deterministic
 * - RPG challenge generation is deterministic
 * - each path remains explicit and non-substitutable in tests
 */
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildCharacterProfile } from '../rpg/character-builder';
import { buildTransitPressureMap } from '../rpg/transit-pressure-map';
import { buildChallengeScene } from '../rpg/challenge-generator';
import { initialCampaignState } from '../rpg/campaign/state-machine';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-campaign-projection-boundaries] ${msg}`);
}

function snapshotWithTransitAspects(): { natal: EphemerisSnapshot; transit: EphemerisSnapshot } {
  const natal: EphemerisSnapshot = {
    ts: '1990-01-01T12:00:00Z',
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
  const transit: EphemerisSnapshot = {
    ...natal,
    ts: '2026-03-15T12:00:00Z',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 195 },
      { name: 'Mercury', lon: 30 },
      { name: 'Venus', lon: 210 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 300 },
      { name: 'Uranus', lon: 120 },
      { name: 'Neptune', lon: 330 },
      { name: 'Pluto', lon: 270 },
    ],
    aspects: [
      { bodyA: 'sun', bodyB: 'saturn', type: 'square', orb: 2 },
      { bodyA: 'moon', bodyB: 'uranus', type: 'conjunction', orb: 1.5 },
      { bodyA: 'venus', bodyB: 'neptune', type: 'trine', orb: 3 },
    ],
    moonPhase: 0.7,
  };
  return { natal, transit };
}

function main(): void {
  const { natal, transit } = snapshotWithTransitAspects();
  const featureVec = encodeFeatures(natal) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, natal, 'campaign-boundary');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['campaign-boundary'],
    snapshot: natal,
    featureVec,
    control_surface_hash: 'campaign-boundary',
    compose_seed: 'campaign-boundary',
    guidance,
  });
  const semanticCore = interpretCanonicalReportObject(canonical);

  const projOpts = {
    phaseD: true as const,
    surface: 'campaign' as const,
    tier: 'extended' as const,
    narrativePlan: null,
    mechanismExpressionDominantSignals: true as const,
  };
  const projectionA = projectTextFromSemanticCore(semanticCore, 'campaign-boundary-seed', projOpts);
  const projectionB = projectTextFromSemanticCore(semanticCore, 'campaign-boundary-seed', projOpts);
  assert(JSON.stringify(projectionA) === JSON.stringify(projectionB), 'unified campaign projection deterministic');
  const projectionValidation = projectionA[projectionA.length - 1]?.meta?.projection_validation;
  assert(!!projectionValidation && projectionValidation.ok === true, 'unified campaign projection validates');

  const bundle = buildRpgEffectsBundleFromSnapshot(natal);
  const character = buildCharacterProfile({
    natalSnapshot: natal,
    featureVec,
    semanticCore,
    dominantPlanetNames: canonical.participants[0].dominant_planet_names,
    effectsBundle: bundle,
  });
  const pressures = buildTransitPressureMap({ natalSnapshot: natal, transitSnapshot: transit });
  assert(pressures.length > 0, 'transit pressure fixture should produce at least one pressure');
  const state = initialCampaignState(bundle);
  const sceneA = buildChallengeScene({
    character,
    pressures,
    state,
    semanticCore,
    natalSnapshot: natal,
    transitSnapshot: transit,
  });
  const sceneB = buildChallengeScene({
    character,
    pressures,
    state,
    semanticCore,
    natalSnapshot: natal,
    transitSnapshot: transit,
  });
  assert(JSON.stringify(sceneA) === JSON.stringify(sceneB), 'RPG challenge generation deterministic');
  assert(sceneA !== null, 'RPG challenge scene should be present');
  const sceneObj = sceneA as unknown as Record<string, unknown>;

  const theme = typeof sceneObj.theme === 'string' ? sceneObj.theme : '';
  assert(
    !theme.includes('In this scenario, you see a stable'),
    'challenge.theme must not use legacy stable scenario opener'
  );
  assert(
    !theme.includes('In this scenario, you see a calmer'),
    'challenge.theme must not use legacy calmer scenario opener'
  );
  assert(!theme.includes('story beat'), 'challenge.theme must not use legacy story-beat opener fragment');

  assert(Array.isArray(projectionA), 'unified campaign projection returns section array');
  assert(!Array.isArray(sceneA), 'RPG challenge scene is not projection section array');
  assert(
    !projectionA.some((s) => s.id === 'audio_staging' || s.id === 'musical') && !('audio_staging' in sceneObj),
    'campaign projection must not emit removed audio_staging/musical sections'
  );

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        canonical_hash: canonical.object_identity_hash,
        unified_campaign_sections: projectionA.length,
        rpg_scene_keys: Object.keys(sceneObj).length,
      },
      null,
      2
    )
  );
}

main();
