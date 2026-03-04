// vnext/rpg/campaign/audio-service.ts
// Deterministic daily audio rails (no generation side effects).

import type { AudioAlgoVersion, AudioSeed, TurnSeed } from '../contracts';
import { makeAudioSeedFromTurnSeed } from '../hash/seeds';
import { getDailyTurnById, createAudioIfMissing, type RpgDailyAudioRow } from '../store/rpg-store';

const AUDIO_ALGO_VERSION = 'audio-v1' as AudioAlgoVersion;

function resolveAudioProvider(): 'none' | 'lyria' | 'local_wav' {
  const raw = (process.env.RPG_AUDIO_PROVIDER || 'none').toLowerCase();
  if (raw === 'none' || raw === 'lyria' || raw === 'local_wav') {
    return raw;
  }
  throw new Error(`Invalid RPG_AUDIO_PROVIDER: ${raw}`);
}

export async function getOrCreateDailyAudioArtifact(params: { turnId: string }): Promise<RpgDailyAudioRow> {
  const { turnId } = params;

  const turn = await getDailyTurnById(turnId);
  if (!turn) {
    throw new Error(`[rpg-audio] Turn not found: ${turnId}`);
  }

  const turnSeed = turn.turn_seed as TurnSeed;
  const provider = resolveAudioProvider();
  const audioSeed = makeAudioSeedFromTurnSeed(turnSeed, AUDIO_ALGO_VERSION) as AudioSeed;

  return createAudioIfMissing({
    turnId: turn.id,
    turnSeed: turn.turn_seed,
    audioAlgoVersion: String(AUDIO_ALGO_VERSION),
    audioSeed: String(audioSeed),
    provider,
  });
}

