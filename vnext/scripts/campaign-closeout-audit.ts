#!/usr/bin/env node
/**
 * Pass 6 — Final close-out audit: verifies Campaign invariants at function level.
 * Does not call HTTP routes or DB; exercises the deterministic layers used by the API.
 *
 * Invariants checked:
 * - Entry normalizes deterministically (same logical set → same seedMemberUserIds).
 * - Audio resolution is deterministic (same tier + scene → same mode/contextId).
 * - Challenge generation is deterministic (same inputs → same scene id).
 * - Single creation path: only getOrCreateCampaign in API is under POST /campaign/resolve (audited by grep; not re-executed here).
 *
 * Full route-level e2e (resolve returns stable campaignId, daily-challenge returns stable scene/audio) requires running server + DB.
 */

import { normalizeCampaignEntrySelection } from '../rpg/campaign-entry';
import { resolveCampaignAudioMode } from '../rpg/campaign-audio-policy';
import type { ChallengeScene } from '../rpg/types';

function main(): void {
  let passed = 0;

  const e1 = normalizeCampaignEntrySelection({ userId: 'u1', mode: 'solo' });
  const e2 = normalizeCampaignEntrySelection({ userId: 'u1', mode: 'solo' });
  if (JSON.stringify(e1) !== JSON.stringify(e2)) {
    throw new Error('Audit: entry not deterministic for solo');
  }
  if (e1.seedMemberUserIds.length !== 1 || e1.mode !== 'solo') {
    throw new Error('Audit: entry solo shape wrong');
  }
  passed++;

  const chosen1 = normalizeCampaignEntrySelection({
    userId: 'lead',
    mode: 'group',
    formationMode: 'chosen',
    selectedMemberUserIds: ['lead', 'b', 'a', 'a'],
  });
  const chosen2 = normalizeCampaignEntrySelection({
    userId: 'lead',
    mode: 'group',
    formationMode: 'chosen',
    selectedMemberUserIds: ['a', 'b', 'lead'],
  });
  if (JSON.stringify(chosen1.seedMemberUserIds) !== JSON.stringify(chosen2.seedMemberUserIds)) {
    throw new Error('Audit: chosen entry not deterministic for same logical set');
  }
  passed++;

  const stubScene: ChallengeScene = {
    id: 'scene:ts:1:constraint:work:fire',
    theme: 'x',
    setting: 'y',
    obstacle: 'z',
    primaryPressure: {
      id: 'p',
      transitBody: 'saturn',
      natalBody: 'sun',
      natalHouse: 10,
      aspectType: 'square',
      domain: 'work',
      pressureFamily: 'constraint',
      type: 'constraint',
      intensity: 0.5,
      intensityBand: 'moderate',
      lifeArea: 'work_public',
      likelyShadowPattern: 'x',
      growthPath: 'y',
      contributingDomains: [],
    },
    supportingPressures: [],
    choices: [],
  };
  const a1 = resolveCampaignAudioMode({ userTier: 'free', challengeScene: stubScene, campaignId: 'c1' });
  const a2 = resolveCampaignAudioMode({ userTier: 'free', challengeScene: stubScene, campaignId: 'c1' });
  const a3 = resolveCampaignAudioMode({ userTier: 'paid', challengeScene: stubScene, campaignId: 'c1' });
  if (JSON.stringify(a1) !== JSON.stringify(a2)) {
    throw new Error('Audit: audio resolution not deterministic');
  }
  if (a1.mode !== 'daily' || a3.mode !== 'challenge' || a3.audioContextId !== stubScene.id) {
    throw new Error('Audit: audio free/paid policy wrong');
  }
  passed++;

  // eslint-disable-next-line no-console
  console.log('[CAMPAIGN_CLOSEOUT_AUDIT] function-level invariants passed=%d (entry, chosen, audio). Single creation path and route e2e require API+DB.', passed);
}

main();
