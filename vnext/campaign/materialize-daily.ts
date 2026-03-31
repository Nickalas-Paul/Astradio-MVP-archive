import type { EphemerisSnapshot } from '../contracts';
import { generateArchitectureFromSnapshot } from '../core/architecture-engine';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildCharacterProfile } from '../rpg/character-builder';
import { buildChallengeScene } from '../rpg/challenge-generator';
import { hashSnapshot } from '../rpg/hash/snapshot-hash';
import { hashCanonicalJson } from '../rpg/hash/json-hash';
import type {
  ArchetypeId,
  CampaignState,
  ChoiceOption,
  NatalBodyModifier,
  ResponseModality,
  ResponsePosture,
} from '../rpg/types';
import type { CampaignResolutionSeed, DailyPressureState, PressureEvent, PressureFamily } from './phase1/contracts';

export interface CharacterSheet {
  id: string;
  class_slug: string;
  subclass_slug: string;
  rising_modifier_slug: string;
  top_domains: Array<{ domain: string; score: number }>;
}

export interface ChallengeArchetype {
  id: string;
  archetype_id: ArchetypeId;
  natal_body_modifier: NatalBodyModifier;
  daily_pressure_state_id: string;
  primary_pressure_event_id: string;
  primary_transit_body: string;
  primary_natal_body: string;
  primary_natal_house: number;
  primary_aspect_type: string;
  primary_pressure_family: PressureFamily;
  primary_domain_id: string;
  primary_intensity_band: DailyPressureState['primary_intensity_band'];
  primary_intensity_score: number;
  interaction_type: DailyPressureState['interaction_type'];
  event_count: number;
  archetype_category: string;
  supporting_domain_pattern: string[];
  supporting_family_pattern: PressureFamily[];
  supporting_member_chart_ids: string[];
  primary_member_chart_ids: string[];
}

export interface ResponsePath {
  path_id: string;
  pattern_tag: string;
  posture: ResponsePosture;
  modality: ResponseModality;
  risk_profile: string;
  outcome_direction: string;
  domain_context: string;
  interaction_context: DailyPressureState['interaction_type'];
  intensity_band: DailyPressureState['primary_intensity_band'];
  ordinal: number;
}

export interface CampaignResolution extends CampaignResolutionSeed {}

export interface MaterializedCampaignDaily {
  character_sheet: CharacterSheet;
  challenge_archetype: ChallengeArchetype;
  challenge: NonNullable<ReturnType<typeof buildChallengeScene>>;
  response_paths: ResponsePath[];
  choice_outcome_patch_ids: Record<string, string>;
  challenge_fingerprint: string;
}

function familyToPressureType(family: PressureFamily): 'constraint' | 'invitation' | 'conflict' | 'confusion' | 'restructuring' {
  switch (family) {
    case 'conflict':
    case 'disruption':
      return 'conflict';
    case 'constraint':
    case 'recurrence':
      return 'constraint';
    case 'dissolution':
    case 'cognitive':
      return 'confusion';
    case 'transformation':
    case 'wound':
      return 'restructuring';
    default:
      return 'invitation';
  }
}

function domainToLifeArea(domain: string): string {
  switch (domain) {
    case 'self':
      return 'identity';
    case 'assets':
      return 'resources';
    case 'communication':
      return 'communication';
    case 'home':
      return 'home_foundations';
    case 'creativity':
      return 'creativity';
    case 'work':
      return 'work_public';
    case 'partnership':
      return 'relationships';
    case 'transformation':
      return 'thresholds';
    case 'belief':
      return 'belief';
    case 'career':
      return 'career_visibility';
    case 'community':
      return 'community';
    case 'subconscious':
      return 'inner_world';
    default:
      return domain;
  }
}

function natalBodyModifier(body: PressureEvent['natal_body']): NatalBodyModifier {
  switch (body) {
    case 'sun':
      return 'core';
    case 'moon':
      return 'felt';
    case 'mercury':
      return 'interpretive';
    case 'venus':
      return 'relational';
    case 'mars':
      return 'volitional';
    case 'jupiter':
      return 'expansive';
    case 'saturn':
      return 'structural';
    case 'uranus':
      return 'disruptive';
    case 'neptune':
      return 'diffuse';
    case 'pluto':
      return 'depth';
    case 'chiron':
    default:
      return 'tender';
  }
}

function isHeavyArchetype(primary: PressureEvent): boolean {
  if (primary.pressure_family === 'wound' || primary.pressure_family === 'transformation' || primary.pressure_family === 'dissolution') {
    return true;
  }
  return primary.intensity_band === 'high' || primary.intensity_band === 'critical';
}

function buildArchetypeId(primary: PressureEvent): ArchetypeId {
  const heavy = isHeavyArchetype(primary);
  switch (primary.domain_id) {
    case 'self':
      return heavy ? 'identity_test' : 'identity_definition';
    case 'assets':
      return heavy ? 'resource_strain' : 'resource_opportunity';
    case 'communication':
      return heavy ? 'signal_friction' : 'signal_reframe';
    case 'home':
    case 'subconscious':
      return heavy ? 'foundation_pressure' : 'foundation_repair';
    case 'creativity':
      return heavy ? 'creative_risk' : 'creative_devotion';
    case 'work':
    case 'career':
      return heavy ? 'duty_pressure' : 'duty_alignment';
    case 'partnership':
    case 'community':
      return heavy ? 'bond_friction' : 'bond_repair';
    case 'transformation':
      return 'threshold_reckoning';
    case 'belief':
      return 'horizon_reorientation';
    default:
      return 'identity_test';
  }
}

function eventToChallengePressure(event: PressureEvent) {
  return {
    id: event.pressure_event_id,
    transitBody: event.transit_body,
    natalBody: event.natal_body,
    natalHouse: event.natal_house,
    aspectType: event.aspect_type,
    domain: event.domain_id,
    pressureFamily: event.pressure_family,
    type: familyToPressureType(event.pressure_family),
    intensity: event.intensity_score,
    intensityBand: event.intensity_band,
    lifeArea: domainToLifeArea(event.domain_id),
    likelyShadowPattern: `phase1_shadow:${event.pressure_polarity}`,
    growthPath: `phase1_growth:${event.interaction_hint}`,
    memberChartId: event.member_chart_id,
    contributingDomains: [
      {
        domain: `campaign_${event.domain_id}`,
        score: event.intensity_score,
        normalizedScore: event.intensity_score,
        contributingSignals: [],
      },
    ],
  };
}

function buildCharacterSheet(snapshot: EphemerisSnapshot): CharacterSheet {
  const bundle = buildRpgEffectsBundleFromSnapshot(snapshot);
  const topDomains = [...bundle.domainSummary]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.domain.localeCompare(b.domain);
    })
    .slice(0, 3)
    .map((d) => ({ domain: d.domain, score: d.score }));

  return {
    id: `char_sheet_${hashSnapshot(snapshot).slice(0, 16)}`,
    class_slug: bundle.classSlug,
    subclass_slug: bundle.subclassSlug,
    rising_modifier_slug: bundle.risingModifierSlug,
    top_domains: topDomains,
  };
}

function choiceToOutcomePatch(choice: ChoiceOption): string {
  return `patch_${choice.outcomeDirection}`;
}

function choiceToDomainAwarePatch(choice: ChoiceOption, domainId: string): string {
  return `${choiceToOutcomePatch(choice)}_${domainId}`;
}

export async function materializeCampaignDaily(params: {
  resolution: CampaignResolution;
  state: CampaignState;
  natalSnapshot: EphemerisSnapshot;
  transitSnapshot: EphemerisSnapshot;
}): Promise<MaterializedCampaignDaily> {
  const { resolution, state, natalSnapshot, transitSnapshot } = params;
  const dailyState = resolution.daily_pressure_state;
  if (!dailyState) {
    throw new Error('daily_pressure_state required');
  }

  const eventById = new Map(resolution.pressure_events.map((event) => [event.pressure_event_id, event]));
  const primary = eventById.get(dailyState.primary_pressure_event_id);
  if (!primary) {
    throw new Error(`primary pressure event missing: ${dailyState.primary_pressure_event_id}`);
  }

  const supporting = dailyState.supporting_pressures
    .map((ref) => eventById.get(ref.pressure_event_id))
    .filter((event): event is PressureEvent => Boolean(event));

  const arch = await generateArchitectureFromSnapshot(natalSnapshot, hashSnapshot(natalSnapshot));
  const seed = hashSnapshot(natalSnapshot);
  const canonicalReport = buildCanonicalReportForSnapshotSurface({
    surface_kind: 'profile_natal',
    subject_ids: [seed],
    snapshot: arch.snapshot,
    featureVec: arch.features,
    control_surface_hash: seed,
    compose_seed: seed,
    guidance: arch.guidance,
  });
  const semanticCore = interpretCanonicalReportObject(canonicalReport);
  const bundle = buildRpgEffectsBundleFromSnapshot(arch.snapshot);
  const character = buildCharacterProfile({
    natalSnapshot: arch.snapshot,
    featureVec: arch.features,
    semanticCore,
    dominantPlanetNames: canonicalReport.participants[0]?.dominant_planet_names ?? [],
    effectsBundle: bundle,
  });

  const scene = buildChallengeScene({
    character,
    pressures: [eventToChallengePressure(primary), ...supporting.map(eventToChallengePressure)],
    state,
    semanticCore,
    natalSnapshot,
    transitSnapshot,
    challengeContext: {
      archetypeCategory: buildArchetypeId(primary),
      archetypeId: buildArchetypeId(primary),
      interactionType: dailyState.interaction_type,
      intensityBand: dailyState.primary_intensity_band,
      pressurePolarity: primary.pressure_polarity,
      primaryDomain: dailyState.primary_domain_id,
      natalBodyModifier: natalBodyModifier(primary.natal_body),
      mechanicTags: dailyState.mechanic_tags,
    },
  });
  if (!scene) {
    throw new Error('challenge unavailable');
  }

  const challengeArchetype: ChallengeArchetype = {
    id: `challenge_${dailyState.daily_pressure_state_id}`,
    archetype_id: buildArchetypeId(primary),
    natal_body_modifier: natalBodyModifier(primary.natal_body),
    daily_pressure_state_id: dailyState.daily_pressure_state_id,
    primary_pressure_event_id: dailyState.primary_pressure_event_id,
    primary_transit_body: primary.transit_body,
    primary_natal_body: primary.natal_body,
    primary_natal_house: primary.natal_house,
    primary_aspect_type: primary.aspect_type,
    primary_pressure_family: dailyState.primary_pressure_family,
    primary_domain_id: dailyState.primary_domain_id,
    primary_intensity_band: dailyState.primary_intensity_band,
    primary_intensity_score: dailyState.primary_intensity_score,
    interaction_type: dailyState.interaction_type,
    event_count: dailyState.event_count,
    archetype_category: buildArchetypeId(primary),
    supporting_domain_pattern: supporting.map((event) => event.domain_id),
    supporting_family_pattern: supporting.map((event) => event.pressure_family),
    supporting_member_chart_ids: supporting
      .map((event) => event.member_chart_id)
      .filter((memberId): memberId is string => Boolean(memberId)),
    primary_member_chart_ids: dailyState.group_context?.primary_member_chart_ids ?? [],
  };

  const responsePaths: ResponsePath[] = scene.choices.map((choice, index) => ({
    path_id: choice.id,
    pattern_tag: choice.patternTag,
    posture: choice.posture,
    modality: choice.modality,
    risk_profile: choice.riskProfile,
    outcome_direction: choice.outcomeDirection,
    domain_context: dailyState.primary_domain_id,
    interaction_context: dailyState.interaction_type,
    intensity_band: dailyState.primary_intensity_band,
    ordinal: index,
  }));

  const choiceOutcomePatchIds = Object.fromEntries(
    scene.choices.map((choice) => [choice.id, choiceToDomainAwarePatch(choice, dailyState.primary_domain_id)])
  );

  const challengeFingerprint = hashCanonicalJson({
    campaign_id: resolution.campaign_id,
    date: resolution.date,
    state_hash_before: resolution.state_hash_before,
    daily_pressure_state_id: dailyState.daily_pressure_state_id,
    challenge_archetype: challengeArchetype,
    scene,
    response_paths: responsePaths,
    choice_outcome_patch_ids: choiceOutcomePatchIds,
  });

  return {
    character_sheet: buildCharacterSheet(natalSnapshot),
    challenge_archetype: challengeArchetype,
    challenge: scene,
    response_paths: responsePaths,
    choice_outcome_patch_ids: choiceOutcomePatchIds,
    challenge_fingerprint: challengeFingerprint,
  };
}
