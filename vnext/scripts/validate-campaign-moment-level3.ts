#!/usr/bin/env node
/**
 * Level 3 Campaign moment validation runner (fixtures + determinism + policy).
 */
import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { buildCampaignPressureResponseParagraph } from '../projection/rule-layer/claim-synthesize';
import { buildCampaignExpressionDigest } from '../campaign/build-campaign-expression-digest';
import type { ProjectionOptions } from '../projection/projection-types';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildCharacterProfile } from '../rpg/character-builder';
import { initialCampaignState } from '../rpg/campaign/state-machine';
import type { DailyPressureState } from '../campaign/phase1/contracts';
import type { CampaignExpressionDigest } from '../projection/projection-types';
import {
  assertDeterminismEqual,
  CAMPAIGN_MOMENT_FALLBACK_PARAGRAPH,
  validateCampaignMomentLevel3,
} from '../campaign/moment-level3-validation';
import { verifyProjectionCampaignStatePolicy } from './check-projection-campaign-state-policy';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[validate-campaign-moment-level3] ${msg}`);
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
    daily_pressure_state_id: 'dps_l3',
    campaign_id: 'camp_l3',
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

function dailyStateGroup(): DailyPressureState {
  const d = minimalDailyState();
  return {
    ...d,
    mode: 'group',
    group_context: {
      member_count: 2,
      contributing_member_chart_ids: ['a', 'b'],
      primary_member_chart_ids: ['a'],
    },
  };
}

/**
 * Moment text from the same builder as `pressure_response` (full surface projection may downgrade tier and omit this section).
 */
function campaignMomentParagraphText(
  semanticCore: ReturnType<typeof interpretCanonicalReportObject>,
  seed: string,
  digest: CampaignExpressionDigest,
  tier: ProjectionOptions['tier']
): string {
  const opts: ProjectionOptions = {
    phaseD: true,
    surface: 'campaign',
    tier: tier ?? 'extended',
    narrativePlan: null,
    campaignExpressionDigest: digest,
  };
  const { text } = buildCampaignPressureResponseParagraph(semanticCore, seed, opts);
  assert(text.trim().length > 0, 'campaign moment paragraph empty');
  return text.trim();
}

function main(): void {
  verifyProjectionCampaignStatePolicy();

  const { natal } = snapshotWithTransitAspects();
  const featureVec = encodeFeatures(natal) as FeatureVec;
  const guidance = guidanceFromFeatures(featureVec, natal, 'l3-moment');
  const canonical = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: ['l3-moment'],
    snapshot: natal,
    featureVec,
    control_surface_hash: 'l3-moment',
    compose_seed: 'l3-moment',
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

  const daily = minimalDailyState();
  const digestBase = buildCampaignExpressionDigest({
    dailyState: daily,
    state,
    characterSheet: sheetLike,
    characterProfile: character,
  });

  const seed = 'l3-validate-seed';

  const textA = campaignMomentParagraphText(semanticCore, seed, digestBase, 'extended');
  const textB = campaignMomentParagraphText(semanticCore, seed, digestBase, 'extended');
  assert(textA === textB, 'determinism: two runs must match');
  assert(assertDeterminismEqual(textA, textB).length === 0, 'determinism helper');

  let r = validateCampaignMomentLevel3(textA, { digest: digestBase, tier: 'extended' });
  assert(r.ok, `case solo extended: ${r.errors.join('; ')}`);

  const digestWithAppendix: CampaignExpressionDigest = {
    ...digestBase,
    continuity: {
      ...digestBase.continuity,
      last_outcome_direction: 'assert_define',
    },
  };
  const textApp = campaignMomentParagraphText(semanticCore, `${seed}:app`, digestWithAppendix, 'extended');
  r = validateCampaignMomentLevel3(textApp, { digest: digestWithAppendix, tier: 'extended' });
  assert(r.ok, `case continuity appendix: ${r.errors.join('; ')}`);

  const dailyG = dailyStateGroup();
  const digestGroup = buildCampaignExpressionDigest({
    dailyState: dailyG,
    state,
    characterSheet: sheetLike,
    characterProfile: character,
  });
  const textG = campaignMomentParagraphText(semanticCore, `${seed}:grp`, digestGroup, 'extended');
  r = validateCampaignMomentLevel3(textG, { digest: digestGroup, tier: 'extended' });
  assert(r.ok, `case group contact: ${r.errors.join('; ')}`);

  r = validateCampaignMomentLevel3(CAMPAIGN_MOMENT_FALLBACK_PARAGRAPH, { digest: digestBase, tier: 'extended' });
  assert(r.ok, `fallback literal: ${r.errors.join('; ')}`);

  // eslint-disable-next-line no-console
  console.log('[validate-campaign-moment-level3] ok');
}

if (require.main === module) {
  main();
}
