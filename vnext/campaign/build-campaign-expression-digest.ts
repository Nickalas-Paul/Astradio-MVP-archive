/**
 * Builds the optional read-only Campaign expression digest for projection (`ProjectionOptions`).
 * Copies only already-resolved fields; no astrology or campaign mechanics are computed here.
 */
import type { CampaignExpressionDigest } from '../projection/projection-types';
import type { DailyPressureState } from './phase1/contracts';
import type { CampaignState } from '../rpg/types';
import { dominantToneKey, topDomainKey } from '../rpg/projection-language';

const IDENTITY_MODIFIER_CAP = 12;

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
}): CampaignExpressionDigest {
  const { dailyState, state, characterSheet } = params;
  const topDomainSlug = characterSheet.top_domains[0]?.domain ?? 'self';
  const identityModifierIds = dailyState.identity_modifier_ids.slice(0, IDENTITY_MODIFIER_CAP);

  return {
    identity: {
      class_slug: characterSheet.class_slug,
      subclass_slug: characterSheet.subclass_slug,
      rising_modifier_slug: characterSheet.rising_modifier_slug,
      top_domain_slug: topDomainSlug,
      identity_modifier_ids: identityModifierIds,
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
  };
}
