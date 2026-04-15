/**
 * Builds the optional read-only Campaign expression digest for projection (`ProjectionOptions`).
 * Copies only already-resolved fields; no astrology or campaign mechanics are computed here.
 *
 * Guarantees: pressure from `DailyPressureState` only; identity mirrors from CharacterSheet + CharacterProfile;
 * progression snapshot in `continuity` only; group fields mirror `mode` / `group_context` (no aggregation).
 */
import type {
  CampaignExpressionDigest,
  CampaignLensAngularEmphasis,
  CampaignLensDomainScoreEntry,
  CampaignLensSignatureDomainEntry,
  CampaignLensTemperament,
} from '../projection/projection-types';
import type { DailyPressureState } from './phase1/contracts';
import type { CampaignState, CharacterProfile } from '../rpg/types';
import { dominantToneKey, topDomainKey } from '../rpg/projection-language';

const PRESSURE_CONTACT_MODIFIER_CAP = 12;
const DOMINANT_PLANETS_CAP = 12;
const SIGNATURE_DOMAINS_RANKED_CAP = 12;

const OUTCOME_DIRECTIONS = new Set<string>([
  'assert_define',
  'engage_advance',
  'observe_hold',
  'withdraw_protect',
  'support_connect',
  'offer_restore',
  'reframe_integrate',
  'contain_limit',
]);

export type CampaignExpressionCharacterSheetLike = {
  class_slug: string;
  subclass_slug: string;
  rising_modifier_slug: string;
  top_domains: Array<{ domain: string; score: number }>;
};

function sortTopDomainsRanked(entries: readonly { domain: string; score: number }[]): CampaignLensDomainScoreEntry[] {
  return [...entries]
    .map((e) => ({ domain: e.domain, score: e.score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.domain.localeCompare(b.domain);
    });
}

function sortSignatureDomainsRanked(
  entries: readonly { domain: string; weight: number }[],
): CampaignLensSignatureDomainEntry[] {
  return [...entries]
    .map((e) => ({ domain: e.domain, weight: e.weight }))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return a.domain.localeCompare(b.domain);
    })
    .slice(0, SIGNATURE_DOMAINS_RANKED_CAP);
}

function mirrorTemperament(t: CharacterProfile['temperament']): CampaignLensTemperament {
  return {
    will: t.will,
    insight: t.insight,
    attunement: t.attunement,
    courage: t.courage,
    discipline: t.discipline,
    adaptability: t.adaptability,
    bond: t.bond,
    shadowCapacity: t.shadowCapacity,
    radiance: t.radiance,
  };
}

function mirrorAngularEmphasis(e: CharacterProfile['angularEmphasis']): CampaignLensAngularEmphasis {
  return {
    first: e.first,
    fourth: e.fourth,
    seventh: e.seventh,
    tenth: e.tenth,
  };
}

function readLastOutcomeDirection(history: readonly string[] | undefined): CampaignExpressionDigest['continuity']['last_outcome_direction'] {
  if (!history?.length) return undefined;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const line = history[i]!;
    const m = /^h:[^:]+:([a-z_]+):[a-z_]+$/.exec(line);
    const token = m?.[1];
    if (token && OUTCOME_DIRECTIONS.has(token)) {
      return token as NonNullable<CampaignExpressionDigest['continuity']['last_outcome_direction']>;
    }
  }
  return undefined;
}

export function buildCampaignExpressionDigest(params: {
  dailyState: DailyPressureState;
  state: CampaignState;
  characterSheet: CampaignExpressionCharacterSheetLike;
  characterProfile: CharacterProfile;
}): CampaignExpressionDigest {
  const { dailyState, state, characterSheet, characterProfile } = params;
  const topDomainSlug = characterSheet.top_domains[0]?.domain ?? 'self';
  const pressureContactModifierIds = dailyState.identity_modifier_ids.slice(0, PRESSURE_CONTACT_MODIFIER_CAP);

  const top_domains_ranked = sortTopDomainsRanked(characterSheet.top_domains);
  const signature_domains_ranked = sortSignatureDomainsRanked(characterProfile.signatureDomains);
  const dominant_planets = [...characterProfile.dominantPlanets]
    .map((s) => String(s).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, DOMINANT_PLANETS_CAP);

  const gc = dailyState.group_context;
  const group_member_count = gc?.member_count ?? 0;
  const group_contributing_member_chart_ids = [...(gc?.contributing_member_chart_ids ?? [])].sort((a, b) =>
    a.localeCompare(b),
  );
  const group_primary_member_chart_ids = [...(gc?.primary_member_chart_ids ?? [])].sort((a, b) => a.localeCompare(b));

  return {
    identity: {
      profile_id: characterProfile.id,
      class_slug: characterSheet.class_slug,
      subclass_slug: characterSheet.subclass_slug,
      rising_modifier_slug: characterSheet.rising_modifier_slug,
      top_domain_slug: topDomainSlug,
      primary_element: characterProfile.primaryElement,
      tonal_polarity: characterProfile.tonalPolarity,
      luminary_weight: characterProfile.luminaryWeight,
      motion_profile: characterProfile.motionProfile,
      gravity_profile: characterProfile.gravityProfile,
      dominant_planets,
      angular_emphasis: mirrorAngularEmphasis(characterProfile.angularEmphasis),
      temperament: mirrorTemperament(characterProfile.temperament),
      top_domains_ranked,
      signature_domains_ranked,
      pressure_contact_modifier_ids: pressureContactModifierIds,
    },
    pressure: {
      primary_domain_id: dailyState.primary_domain_id,
      primary_intensity_band: dailyState.primary_intensity_band,
      primary_pressure_family: dailyState.primary_pressure_family,
      primary_pressure_polarity: dailyState.primary_pressure_polarity,
      interaction_type: dailyState.interaction_type,
      primary_transit_body: dailyState.primary_transit_body,
      primary_natal_body: dailyState.primary_natal_body,
      primary_natal_house: dailyState.primary_natal_house,
      primary_aspect_type: dailyState.primary_aspect_type,
      supporting_count: dailyState.supporting_pressures.length,
    },
    continuity: {
      chapter: state.chapter,
      dominant_tone_key: dominantToneKey(state),
      top_domain_key: topDomainKey(state),
      last_outcome_direction: readLastOutcomeDirection(state.history),
    },
    campaign_mode: dailyState.mode,
    group_member_count,
    group_contributing_member_chart_ids,
    group_primary_member_chart_ids,
  };
}
