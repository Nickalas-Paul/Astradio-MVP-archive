// vnext/rpg/hash/seeds.ts
// Deterministic seed derivation for RPG turns and audio.

import { sha256Hex } from './json-hash';
import type {
  TransitHash,
  StateHash,
  TurnSeed,
  AudioSeed,
  RpgAlgoVersion,
  AudioAlgoVersion,
} from '../contracts';

export function makeTurnSeed(
  transitHash: TransitHash,
  stateHash: StateHash,
  rpgAlgoVersion: RpgAlgoVersion
): TurnSeed {
  const payload = `turn:${transitHash}|${stateHash}|${rpgAlgoVersion}`;
  const digest = sha256Hex(payload);
  return digest as TurnSeed;
}

export function makeAudioSeed(
  transitHash: TransitHash,
  audioAlgoVersion: AudioAlgoVersion
): AudioSeed {
  const payload = `audio:${transitHash}|${audioAlgoVersion}`;
  const digest = sha256Hex(payload);
  return digest as AudioSeed;
}

