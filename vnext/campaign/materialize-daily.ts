import type { EphemerisSnapshot } from '../contracts';
import { generateArchitectureFromSnapshot } from '../core/architecture-engine';
import { buildCanonicalReportForSnapshotSurface } from '../canonical/build-from-compose-context';
import { interpretCanonicalReportObject } from '../semantic/semantic-authority';
import { buildRpgEffectsBundleFromSnapshot } from '../rpg/effects/bundle-from-snapshot';
import { buildCharacterProfile } from '../rpg/character-builder';
import { buildChallengeScene } from '../rpg/challenge-generator';
import { hashSnapshot } from '../rpg/hash/snapshot-hash';
import { hashCanonicalJson } from '../rpg/hash/json-hash';
import type { CampaignState, ChoiceOption } from '../rpg/types';
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
  daily_pressure_state_id: string;
  primary_pressure_event_id: string;
  primary_pressure_family: PressureFamily;
  primary_domain_id: string;
  interaction_type: DailyPressureState['interaction_type'];
  event_count: number;
}

export interface ResponsePath {
  path_id: string;
  pattern_tag: string;
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
  if (domain === 'self' || domain === 'belief') return 'identity';
  if (domain === 'partnership' || domain === 'community') return 'relationships';
  if (domain === 'career' || domain === 'work') return 'work_public';
  if (domain === 'home' || domain === 'assets') return 'home_foundations';
  if (domain === 'creativity' || domain === 'subconscious') return 'inner_world';
  return 'inner_world';
}

function eventToChallengePressure(event: PressureEvent) {
  return {
    id: event.pressure_event_id,
    domain: event.domain_id,
    type: familyToPressureType(event.pressure_family),
    intensity: event.intensity_score,
    lifeArea: domainToLifeArea(event.domain_id),
    likelyShadowPattern: `phase1_shadow:${event.pressure_polarity}`,
    growthPath: `phase1_growth:${event.interaction_hint}`,
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
  switch (choice.patternTag) {
    case 'pause_observe':
    case 'delay_action':
      return 'patch_defer_decision';
    case 'name_truth':
    case 'push_forward':
      return 'patch_increase_identity_resolve';
    case 'seek_counsel':
    case 'draw_boundary':
    case 'make_offering':
    default:
      return 'patch_strengthen_bond';
  }
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
  });
  if (!scene) {
    throw new Error('challenge unavailable');
  }

  const challengeArchetype: ChallengeArchetype = {
    id: `challenge_${dailyState.daily_pressure_state_id}`,
    daily_pressure_state_id: dailyState.daily_pressure_state_id,
    primary_pressure_event_id: dailyState.primary_pressure_event_id,
    primary_pressure_family: dailyState.primary_pressure_family,
    primary_domain_id: dailyState.primary_domain_id,
    interaction_type: dailyState.interaction_type,
    event_count: dailyState.event_count,
  };

  const responsePaths: ResponsePath[] = scene.choices.map((choice, index) => ({
    path_id: choice.id,
    pattern_tag: choice.patternTag,
    ordinal: index,
  }));

  const choiceOutcomePatchIds = Object.fromEntries(
    scene.choices.map((choice) => [choice.id, choiceToOutcomePatch(choice)])
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
