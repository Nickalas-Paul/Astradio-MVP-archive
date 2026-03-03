#!/usr/bin/env node
/**
 * Phase 7 Slice 4 — Transit domain engine tests.
 *
 * Pipeline:
 *   EphemerisSnapshot (transit) -> RPGTransitSignal[] -> RPGDomainScore[] -> RpgPromptSpec
 *
 * Asserts:
 * - Determinism under key reordering (canonical JSON equal).
 * - Sensitivity to transit changes (prompt spec changes).
 * - Stability of prompt spec under snapshot key reordering.
 */

import type { EphemerisSnapshot } from '../contracts';
import { canonicalJsonString, hashCanonicalJson } from '../rpg/hash/json-hash';
import { hashSnapshot } from '../rpg/hash/snapshot-hash';
import { makeTurnSeed } from '../rpg/hash/seeds';
import type { StateHash, RpgAlgoVersion, TurnSeed, TransitHash } from '../rpg/contracts';
import { detectTransitSignals } from '../rpg/transit/signal-detection';
import { translateSignalsToDomains } from '../rpg/transit/domain-translation';
import { projectNarrativeFromDomains } from '../rpg/transit/narrative-projection';

function assert(condition: boolean, message: string, failedRef: { value: boolean }): void {
  if (!condition) {
    // eslint-disable-next-line no-console
    console.error(`FAIL: ${message}`);
    failedRef.value = true;
  } else {
    // eslint-disable-next-line no-console
    console.log(`✓ ${message}`);
  }
}

function makeTransitSnapshot(): EphemerisSnapshot {
  return {
    ts: '2026-03-03T12:00:00Z',
    tz: 'UTC',
    lat: 40.7128,
    lon: -74.006,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: 15 },
      { name: 'Moon', lon: 195 },
      { name: 'Mercury', lon: 30 },
      { name: 'Venus', lon: 210 },
      { name: 'Mars', lon: 90 },
      { name: 'Jupiter', lon: 105 },
      { name: 'Saturn', lon: 300 },
      { name: 'Uranus', lon: 120 },
      { name: 'Neptune', lon: 330 },
      { name: 'Pluto', lon: 270 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [
      { a: 'Sun', b: 'Saturn', type: 'square', orb: 2 },
      { a: 'Moon', b: 'Uranus', type: 'conjunction', orb: 1.5 },
      { a: 'Venus', b: 'Neptune', type: 'trine', orb: 3 },
    ],
    moonPhase: 0.7,
    dominantElements: { fire: 1, earth: 0, air: 0, water: 0 },
  };
}

function makeTransitSnapshotReordered(): EphemerisSnapshot {
  const base = makeTransitSnapshot();
  const reordered: EphemerisSnapshot = {
    houseSystem: base.houseSystem,
    lon: base.lon,
    lat: base.lat,
    dominantElements: base.dominantElements,
    ts: base.ts,
    tz: base.tz,
    planets: base.planets,
    houses: base.houses,
    aspects: base.aspects,
    moonPhase: base.moonPhase,
  };
  return reordered;
}

function buildPrompt(snapshot: EphemerisSnapshot, state: object): { seed: TurnSeed; json: string } {
  const transitHash = hashSnapshot(snapshot) as TransitHash;
  const stateHash = hashCanonicalJson(state) as StateHash;
  const algo = 'rpg-v1' as RpgAlgoVersion;
  const seed = makeTurnSeed(transitHash, stateHash, algo);

  const signals = detectTransitSignals(snapshot);
  const domains = translateSignalsToDomains(signals);
  const prompt = projectNarrativeFromDomains(seed, domains);
  const json = canonicalJsonString(prompt);
  return { seed, json };
}

function runDeterminismTests(failedRef: { value: boolean }): void {
  const base = makeTransitSnapshot();
  const reordered = makeTransitSnapshotReordered();
  const state = { campaign: 'solo', step: 1 };

  const p1 = buildPrompt(base, state);
  const p2 = buildPrompt(reordered, state);

  const parsed = JSON.parse(p1.json) as { scenario_id: string };

  assert(
    p1.json === p2.json,
    'Prompt spec is stable under snapshot key reordering',
    failedRef
  );

  assert(
    parsed.scenario_id === 'scn_identity_crossroads',
    'Base fixture maps to expected scenario_id scn_identity_crossroads',
    failedRef
  );
}

function runSensitivityTests(failedRef: { value: boolean }): void {
  const base = makeTransitSnapshot();
  const state = { campaign: 'solo', step: 1 };
  const p1 = buildPrompt(base, state);

  const modified: EphemerisSnapshot = {
    ...makeTransitSnapshot(),
    aspects: [
      // Remove Sun-Saturn square entirely to drop identity_heat signal
      { a: 'Moon', b: 'Uranus', type: 'conjunction', orb: 1.5 },
      { a: 'Venus', b: 'Neptune', type: 'trine', orb: 3 }
    ],
  };

  const p2 = buildPrompt(modified, state);

  assert(
    p1.json !== p2.json,
    'Prompt spec changes when transit configuration changes materially',
    failedRef
  );
}

function main(): void {
  const failed = { value: false };

  // eslint-disable-next-line no-console
  console.log('Running Phase 7 RPG transit engine tests...');

  runDeterminismTests(failed);
  runSensitivityTests(failed);

  if (failed.value) {
    // eslint-disable-next-line no-console
    console.error('\n❌ Phase 7 RPG transit tests failed');
    process.exit(1);
  } else {
    // eslint-disable-next-line no-console
    console.log('\n✅ Phase 7 RPG transit tests passed');
  }
}

main();

