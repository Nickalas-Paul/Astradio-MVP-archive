#!/usr/bin/env node
/**
 * Pass 4 — Determinism guard: same inputs → same audio resolution.
 */

import { resolveCampaignAudioMode } from '../rpg/campaign-audio-policy';
import type { ChallengeScene } from '../rpg/types';

function main(): void {
  const stubScene: ChallengeScene = {
    id: 'scene:2026-03-15T12:00:00Z:1:constraint:work_public:fire',
    theme: 'Public pressure: running into a real limit',
    setting: 'a work or visibility setting',
    obstacle: 'A live situation in the work_public area carries constraint pressure.',
    primaryPressure: {
      id: 'tp_0_identity_heat',
      domain: 'identity_heat',
      type: 'constraint',
      intensity: 0.9,
      lifeArea: 'work_public',
      likelyShadowPattern: 'pushing harder',
      growthPath: 'name the actual limit',
      contributingDomains: [],
    },
    supportingPressures: [],
    choices: [{ id: 'pause_observe', label: 'Pause and observe', symbolicGesture: 'step back', patternTag: 'pause_observe' }],
  };

  const campaignId = 'rpg_camp_test123';

  const r1Free = resolveCampaignAudioMode({ userTier: 'free', challengeScene: stubScene, campaignId });
  const r2Free = resolveCampaignAudioMode({ userTier: 'free', challengeScene: stubScene, campaignId });

  const r1Paid = resolveCampaignAudioMode({ userTier: 'paid', challengeScene: stubScene, campaignId });
  const r2Paid = resolveCampaignAudioMode({ userTier: 'paid', challengeScene: stubScene, campaignId });

  if (JSON.stringify(r1Free) !== JSON.stringify(r2Free) || JSON.stringify(r1Paid) !== JSON.stringify(r2Paid)) {
    // eslint-disable-next-line no-console
    console.error('FAIL: same inputs → different audio resolution');
    process.exit(1);
  }

  if (r1Free.mode !== 'daily' || r1Free.audioContextId !== undefined) {
    // eslint-disable-next-line no-console
    console.error('FAIL: free tier should resolve to mode daily, no audioContextId');
    process.exit(1);
  }

  if (r1Paid.mode !== 'challenge' || r1Paid.audioContextId !== stubScene.id) {
    // eslint-disable-next-line no-console
    console.error('FAIL: paid tier should resolve to mode challenge with audioContextId = scene.id');
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('OK: campaign audio resolution is deterministic (same inputs → same audio mode + context)');
}

main();
