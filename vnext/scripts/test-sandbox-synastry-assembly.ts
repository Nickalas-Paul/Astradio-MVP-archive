/**
 * Unit tests for sandbox synastry report assembly (pair cap, tier priority, group diversification).
 */
import assert from 'node:assert/strict';
import type { EphemerisSnapshot } from '../contracts';
import type { DirectedSnapshotAspect } from '../synastry/synastry-types';
import {
  assembleSandboxSynastryReport,
  SANDBOX_SYNASTRY_MAX_ACTIVATIONS_PER_PAIR,
} from '../projection/rule-layer/sandbox-synastry-assembly';

function minimalSnapshot(planets: Array<{ name: string; lon: number }>): EphemerisSnapshot {
  return {
    ts: '2000-01-01T12:00:00',
    tz: 'UTC',
    lat: 0,
    lon: 0,
    houseSystem: 'P',
    planets,
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

function directedAspect(
  partial: Partial<DirectedSnapshotAspect> & Pick<DirectedSnapshotAspect, 'bodyA' | 'bodyB' | 'type'>
): DirectedSnapshotAspect {
  return {
    orb: 1,
    exactness: 0.9,
    priorityBase: 0.8,
    strength: 0.9,
    sourceSlotIndex: 0,
    targetSlotIndex: 1,
    ...partial,
  };
}

function testPairCapsAtThree(): void {
  const aspects: DirectedSnapshotAspect[] = [
    directedAspect({ bodyA: 'sun', bodyB: 'moon', type: 'conjunction', exactness: 0.95 }),
    directedAspect({ bodyA: 'moon', bodyB: 'venus', type: 'trine', exactness: 0.9 }),
    directedAspect({ bodyA: 'mercury', bodyB: 'mars', type: 'square', exactness: 0.85 }),
    directedAspect({ bodyA: 'venus', bodyB: 'jupiter', type: 'sextile', exactness: 0.8 }),
    directedAspect({ bodyA: 'mars', bodyB: 'saturn', type: 'opposition', exactness: 0.75 }),
  ];
  const report = assembleSandboxSynastryReport({
    mode: 'pair',
    participants: [
      { slotIndex: 0, label: 'Alice' },
      { slotIndex: 1, label: 'Bob' },
    ],
    snapshotsOrdered: [minimalSnapshot([{ name: 'sun', lon: 0 }]), minimalSnapshot([{ name: 'moon', lon: 0 }])],
    pairInteractionAspectsV2: aspects,
  });
  const total = report.pairSections[0]?.tierBlocks.reduce((n, t) => n + t.activations.length, 0) ?? 0;
  assert.equal(total, SANDBOX_SYNASTRY_MAX_ACTIVATIONS_PER_PAIR);
  assert.ok(report.pairSections[0]?.tierBlocks.some((t) => t.tierId === 'personal'));
}

function testGroupDiversification(): void {
  const aspects: DirectedSnapshotAspect[] = [
    directedAspect({ bodyA: 'sun', bodyB: 'mars', type: 'conjunction', sourceSlotIndex: 0, targetSlotIndex: 1, exactness: 0.99 }),
    directedAspect({ bodyA: 'sun', bodyB: 'mars', type: 'square', sourceSlotIndex: 1, targetSlotIndex: 2, exactness: 0.98 }),
    directedAspect({ bodyA: 'moon', bodyB: 'venus', type: 'trine', sourceSlotIndex: 0, targetSlotIndex: 2, exactness: 0.97 }),
  ];
  const snaps = [
    minimalSnapshot([{ name: 'sun', lon: 0 }]),
    minimalSnapshot([{ name: 'mars', lon: 0 }]),
    minimalSnapshot([{ name: 'venus', lon: 0 }]),
  ];
  const report = assembleSandboxSynastryReport({
    mode: 'group',
    participants: [
      { slotIndex: 0, label: 'A' },
      { slotIndex: 1, label: 'B' },
      { slotIndex: 2, label: 'C' },
    ],
    snapshotsOrdered: snaps,
    pairInteractionAspectsV2: aspects,
  });
  const pairFields = report.pairSections.flatMap((s) =>
    s.tierBlocks.flatMap((t) => t.activations.map((a) => a.pairField))
  );
  const unique = new Set(pairFields);
  assert.equal(unique.size, pairFields.length, 'planetary pair fields must not repeat across group sections');
}

function testEmptyWhenNoLibraryHits(): void {
  const report = assembleSandboxSynastryReport({
    mode: 'pair',
    participants: [
      { slotIndex: 0, label: 'A' },
      { slotIndex: 1, label: 'B' },
    ],
    snapshotsOrdered: [minimalSnapshot([]), minimalSnapshot([])],
    pairInteractionAspectsV2: [
      directedAspect({ bodyA: 'northnode', bodyB: 'sun', type: 'conjunction' }),
    ],
  });
  assert.equal(report.pairSections.length, 0);
}

testPairCapsAtThree();
testGroupDiversification();
testEmptyWhenNoLibraryHits();
console.log('[test-sandbox-synastry-assembly] OK');
