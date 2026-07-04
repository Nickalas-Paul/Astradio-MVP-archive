/**
 * Verify group assembly with group_matrix precompute (mirrors sandbox-composition-execute fix).
 */
import type { EphemerisSnapshot } from '../contracts';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { assembleSandboxSynastryReport } from '../projection/rule-layer/sandbox-synastry-assembly';

function snap(offset: number): EphemerisSnapshot {
  const base = 15 + offset * 17;
  return {
    ts: '2000-01-01T12:00:00Z',
    tz: 'UTC',
    lat: 40.7 + offset,
    lon: -74 + offset,
    houseSystem: 'placidus',
    planets: [
      { name: 'Sun', lon: base },
      { name: 'Moon', lon: base + 30 },
      { name: 'Mercury', lon: base + 60 },
      { name: 'Venus', lon: base + 75 },
      { name: 'Mars', lon: base + 90 },
      { name: 'Jupiter', lon: base + 105 },
      { name: 'Saturn', lon: base + 120 },
      { name: 'Uranus', lon: base + 135 },
      { name: 'Neptune', lon: base + 150 },
      { name: 'Pluto', lon: base + 165 },
    ],
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
  };
}

const snapshots = [snap(0), snap(1), snap(2)];
const matrix = computeSynastryAspects({ snapshotsOrdered: snapshots, mode: 'group_matrix' });
const report = assembleSandboxSynastryReport({
  mode: 'group',
  participants: [
    { slotIndex: 0, label: 'A' },
    { slotIndex: 1, label: 'B' },
    { slotIndex: 2, label: 'C' },
  ],
  snapshotsOrdered: snapshots,
  pairInteractionAspectsV2: matrix,
});

const pairFields = report.pairSections.flatMap((s) =>
  s.tierBlocks.flatMap((t) => t.activations.map((a) => a.pairField))
);
const acts = report.pairSections.map((s) =>
  s.tierBlocks.reduce((n, t) => n + t.activations.length, 0)
);

console.log('pairSections:', report.pairSections.length, 'expected 2-3');
console.log('activations per section:', acts.join(', '));
console.log('unique pairFields:', new Set(pairFields).size, 'total:', pairFields.length);
if (report.pairSections.length < 2) process.exit(1);
if (pairFields.length !== new Set(pairFields).size) process.exit(1);
