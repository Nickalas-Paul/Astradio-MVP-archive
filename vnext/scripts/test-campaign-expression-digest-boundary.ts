#!/usr/bin/env node
/**
 * Campaign expression digest boundary: wiring, no-op output parity, determinism, scope isolation.
 */
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { projectTextFromSemanticCore } from '../projection/text-projection';
import { applyUnifiedProjection } from '../projection/rule-layer/apply-unified-projection';
import { campaignExpressionDigestFromOptions } from '../projection/campaign-expression-digest-guard';
import { buildCampaignExpressionDigest } from '../campaign/build-campaign-expression-digest';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildCharacterProfile } from '../rpg/character-builder';
import { buildTransitPressureMap } from '../rpg/transit-pressure-map';
import { buildChallengeScene } from '../rpg/challenge-generator';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import type { DailyPressureState } from '../campaign/phase1/contracts';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-campaign-expression-digest-boundary] ${msg}`);
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

function minimalDailyState(): DailyPressureState {
  return {
    daily_pressure_state_id: 'dps_test',
    campaign_id: 'camp_test',
    mode: 'solo',
    date: '2026-04-15',
    primary_pressure_event_id: 'pe_primary',
    primary_transit_body: 'mars',
    primary_natal_body: 'venus',
    primary_natal_house: 7,
    primary_aspect_type: 'square',
    primary_pressure_family: 'conflict',
    primary_pressure_polarity: 'frictional',
    primary_domain_id: 'partnership',
    primary_intensity_score: 0.7,
    primary_intensity_band: 'high',
    supporting_pressures: [],
    interaction_type: 'reinforcing',
    activated_trait_ids: [],
    identity_modifier_ids: ['im_a', 'im_b'],
    mechanic_tags: [],
    carryover_bias: 0,
    uncertainty_modifier: 0,
    event_count: 1,
    eligible_event_count: 1,
    ranking_trace: {
      candidate_pressure_event_ids: ['pe_primary'],
      filtered_out_event_ids: [],
      merged_cluster_ids: [],
      tie_break_rule_applied: 'none',
    },
    provenance: {
      pressure_event_set_hash: 'x',
      engine_version: 'campaign_phase1_v1',
      rules_version: 'campaign_contract_v1',
    },
  };
}

function main(): void {
  const dailyState = minimalDailyState();
  const { natal, transit } = snapshotWithTransitAspects();
  const featureVec = encodeFeatures(natal) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, natal, 'digest-boundary');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['digest-boundary'],
    snapshot: natal,
    featureVec,
    control_surface_hash: 'digest-boundary',
    compose_seed: 'digest-boundary',
    guidance,
  });
  const semanticCore = interpretCanonicalReportObject(canonical);
  const bundle = buildRpgEffectsBundleFromSnapshot(natal);
  const state = initialCampaignState(bundle);
  const sheetLike = {
    class_slug: 'test_class',
    subclass_slug: 'test_sub',
    rising_modifier_slug: 'test_rise',
    top_domains: [{ domain: 'work', score: 0.9 }],
  };
  const character = buildCharacterProfile({
    natalSnapshot: natal,
    featureVec,
    semanticCore,
    dominantPlanetNames: canonical.participants[0].dominant_planet_names,
    effectsBundle: bundle,
  });
  const digest = buildCampaignExpressionDigest({ dailyState, state, characterSheet: sheetLike, characterProfile: character });

  assert(digest.identity.class_slug === 'test_class', 'digest identity.class_slug');
  assert(digest.identity.profile_id === character.id, 'digest identity.profile_id');
  assert(digest.identity.pressure_contact_modifier_ids.join('|') === 'im_a|im_b', 'digest pressure_contact_modifier_ids');
  assert(digest.pressure.primary_domain_id === 'partnership', 'digest pressure.primary_domain_id');
  assert(digest.pressure.supporting_count === 0, 'digest supporting_count');
  assert(digest.continuity.chapter === 1, 'digest chapter');
  assert(typeof digest.continuity.dominant_tone_key === 'string', 'digest dominant_tone_key');
  assert(digest.campaign_mode === 'solo', 'digest campaign_mode');
  assert(digest.group_member_count === 0, 'digest group mirror solo');
  assert(digest.identity.top_domains_ranked.length === 1 && digest.identity.top_domains_ranked[0]!.domain === 'work', 'top_domains_ranked');

  const baseOpts = {
    phaseD: true as const,
    surface: 'campaign' as const,
    tier: 'baseline' as const,
    narrativePlan: null,
    aspectTension: null,
  };
  const withDigestA = projectTextFromSemanticCore(semanticCore, 'digest-seed-a', {
    ...baseOpts,
    campaignExpressionDigest: digest,
  });
  const withDigestB = projectTextFromSemanticCore(semanticCore, 'digest-seed-a', {
    ...baseOpts,
    campaignExpressionDigest: digest,
  });
  assert(JSON.stringify(withDigestA) === JSON.stringify(withDigestB), 'campaign projection deterministic with digest');

  const withoutDigestA = projectTextFromSemanticCore(semanticCore, 'digest-seed-a', baseOpts);
  const withoutDigestB = projectTextFromSemanticCore(semanticCore, 'digest-seed-a', baseOpts);
  assert(JSON.stringify(withoutDigestA) === JSON.stringify(withoutDigestB), 'campaign projection deterministic without digest');

  const joinedWith = withDigestA.map((s) => s.text).join('\n').toLowerCase();
  assert(joinedWith.includes('mars'), 'digest-driven moment includes transit body');
  assert(joinedWith.includes('venus'), 'digest-driven moment includes natal body');
  assert(joinedWith.includes('square'), 'digest-driven moment includes aspect');
  assert(joinedWith.includes('house 7'), 'digest-driven moment includes house');
  assert(!joinedWith.includes('scenario pressure'), 'forbidden coaching label absent');
  assert(!joinedWith.includes('response shape'), 'forbidden coaching label absent');

  const joinedDefault = withoutDigestA.map((s) => s.text).join('\n').toLowerCase();
  assert(joinedDefault.includes('saturn') && joinedDefault.includes('sun'), 'default digest moment uses fallback bodies');

  assert(campaignExpressionDigestFromOptions(undefined) === undefined, 'guard undefined options');
  assert(campaignExpressionDigestFromOptions({ ...baseOpts, surface: 'profile' }) === undefined, 'guard non-campaign surface');
  assert(
    campaignExpressionDigestFromOptions({ ...baseOpts, campaignExpressionDigest: digest }) === digest,
    'guard returns digest on campaign surface'
  );

  let threw = false;
  try {
    projectTextFromSemanticCore(semanticCore, 'digest-seed-b', {
      phaseD: true,
      surface: 'profile',
      tier: 'baseline',
      narrativePlan: null,
      campaignExpressionDigest: digest,
    });
  } catch {
    threw = true;
  }
  assert(threw, 'digest on profile surface must throw');

  const pressures = buildTransitPressureMap({ natalSnapshot: natal, transitSnapshot: transit });
  const sceneNoDigest = buildChallengeScene({
    character,
    pressures,
    state,
    semanticCore,
    natalSnapshot: natal,
    transitSnapshot: transit,
  });
  const sceneWithDigest = buildChallengeScene({
    character,
    pressures,
    state,
    semanticCore,
    natalSnapshot: natal,
    transitSnapshot: transit,
    campaignExpressionDigest: digest,
  });
  assert(JSON.stringify(sceneNoDigest) === JSON.stringify(sceneWithDigest), 'challenge scene unchanged with digest');

  const sandboxA = applyUnifiedProjection(semanticCore, 'digest-seed-c', {
    phaseD: true,
    surface: 'sandbox',
    tier: 'baseline',
    narrativePlan: null,
  });
  const sandboxB = applyUnifiedProjection(semanticCore, 'digest-seed-c', {
    phaseD: true,
    surface: 'sandbox',
    tier: 'baseline',
    narrativePlan: null,
  });
  assert(JSON.stringify(sandboxA) === JSON.stringify(sandboxB), 'sandbox determinism untouched');

  // eslint-disable-next-line no-console
  console.log('[test-campaign-expression-digest-boundary] ok');
}

main();
