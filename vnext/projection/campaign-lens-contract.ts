import type { CampaignExpressionDigest } from './projection-types';

/**
 * Level 1 Character Lens — contract guarantees (implementation reference only).
 *
 * - **Pressure** (`digest.pressure`): copied from `DailyPressureState` only; authoritative for the day.
 * - **Identity** (`digest.identity`): mirrors CharacterSheet + CharacterProfile; shapes expression, never overrides pressure facts.
 * - **Progression** (`digest.continuity`): sole progression snapshot for projection; do not read `CampaignState` in `vnext/projection`.
 * - **Group** (`digest.campaign_mode`, `digest.group_*`): mirror `DailyPressureState` / `group_context` only; constrain field context, do not override identity or pressure.
 */
export const CAMPAIGN_LENS_CONTRACT_VERSION = 'campaign_lens_v1' as const;

/** Projection-facing progression: always use `digest.continuity`, never parallel CampaignState reads. */
export function campaignContinuityFromDigest(digest: CampaignExpressionDigest): CampaignExpressionDigest['continuity'] {
  return digest.continuity;
}
