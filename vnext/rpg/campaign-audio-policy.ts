// vnext/rpg/campaign-audio-policy.ts
// Pass 4 — Pure resolver: which audio context attaches to a campaign challenge.
// No DB writes, no audio generation, no music engine calls.

import type { ChallengeScene } from './types';

export type UserTier = 'free' | 'paid';

/**
 * Resolved audio context for a challenge response.
 * Free: use default daily login-generated soundtrack (no challenge-specific id).
 * Paid: use challenge-specific soundtrack; audioContextId is deterministic from the scene.
 */
export interface CampaignAudioMode {
  mode: 'daily' | 'challenge';
  audioContextId?: string;
}

export interface ResolveCampaignAudioParams {
  userTier: UserTier;
  challengeScene: ChallengeScene | null;
  campaignId: string;
}

/**
 * Deterministic: same (userTier, challengeScene, campaignId) → same CampaignAudioMode.
 * Free users: daily mode, no audioContextId.
 * Paid users: challenge mode, audioContextId = challengeScene.id (stable scene identity).
 */
export function resolveCampaignAudioMode(params: ResolveCampaignAudioParams): CampaignAudioMode {
  const { userTier, challengeScene, campaignId } = params;

  if (userTier === 'free') {
    return { mode: 'daily' };
  }

  if (userTier === 'paid' && challengeScene?.id) {
    return {
      mode: 'challenge',
      audioContextId: challengeScene.id,
    };
  }

  return { mode: 'daily' };
}
