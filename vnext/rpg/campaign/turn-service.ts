// vnext/rpg/campaign/turn-service.ts
// Deterministic daily turn creation service.

import type { EphemerisSnapshot } from '../../contracts';
import { hashSnapshot } from '../hash/snapshot-hash';
import { hashCanonicalJson } from '../hash/json-hash';
import { makeTurnSeed } from '../hash/seeds';
import type { RpgAlgoVersion, TransitHash, StateHash, TurnSeed } from '../contracts';
import { detectTransitSignals } from '../transit/signal-detection';
import { translateSignalsToDomains } from '../transit/domain-translation';
import { projectNarrativeFromDomains } from '../transit/narrative-projection';
import { createDailyTurnIfMissing, getDailyTurnBySeed, type RpgDailyTurnRow } from '../store/rpg-store';

const RPG_ALGO_VERSION = 'rpg-v1' as RpgAlgoVersion;

export async function getOrCreateDailyTurn(params: {
  campaignId: string;
  transitSnapshot: EphemerisSnapshot;
  stateJson: unknown;
}): Promise<RpgDailyTurnRow> {
  const { campaignId, transitSnapshot, stateJson } = params;

  const transitHash = hashSnapshot(transitSnapshot) as TransitHash;
  const stateHash = hashCanonicalJson(stateJson) as StateHash;
  const seed = makeTurnSeed(transitHash, stateHash, RPG_ALGO_VERSION);

  const existing = await getDailyTurnBySeed(seed);
  if (existing) {
    return existing;
  }

  const signals = detectTransitSignals(transitSnapshot);
  const domains = translateSignalsToDomains(signals);
  const promptSpec = projectNarrativeFromDomains(seed, domains);

  const row = await createDailyTurnIfMissing({
    campaignId,
    turnSeed: seed,
    transitSnapshotHash: transitHash,
    stateHash,
    rpgAlgoVersion: RPG_ALGO_VERSION,
    promptSpec,
  });

  return row;
}

