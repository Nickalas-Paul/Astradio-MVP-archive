/**
 * Audit trace: group synastry assembly diversification (do not commit to production assembly).
 * Run: npx tsx vnext/scripts/audit-group-synastry-trace.ts
 */
import type { EphemerisSnapshot } from '../contracts';
import { computeSynastryAspects } from '../synastry/synastry-compute';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { isAspectLibraryKillListed } from '../projection/insight-library/aspect-library-kill-list';
import { composeSynastryMepAspectParagraph } from '../projection/insight-library/synastry-aspect-library-render';

const SANDBOX_SYNASTRY_MAX_ACTIVATIONS_PER_PAIR = 3;

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

function tierForNatalBody(bodyA: string): string | null {
  const p = bodyA.toUpperCase();
  if (['SUN', 'MOON', 'MERCURY', 'VENUS', 'MARS'].includes(p)) return 'personal';
  if (['JUPITER', 'SATURN'].includes(p)) return 'social';
  if (['URANUS', 'NEPTUNE', 'PLUTO', 'CHIRON', 'CERES', 'JUNO', 'PALLAS', 'VESTA'].includes(p)) return 'generational';
  return null;
}

function aspectQualifies(asp: { bodyA: string; bodyB: string; type: string }): { ok: boolean; pairField?: string } {
  if (!tierForNatalBody(asp.bodyA)) return { ok: false };
  const key = buildAspectKey(asp.bodyA, asp.bodyB, asp.type);
  if (isAspectLibraryKillListed(key)) return { ok: false };
  const ins = getAspectInsight(key);
  if (!ins) return { ok: false };
  const prose = composeSynastryMepAspectParagraph(ins).trim();
  if (!prose) return { ok: false };
  return { ok: true, pairField: ins.pair };
}

/** Mirrors sandbox-synastry-assembly.ts aspectsForPair (no precomputed). */
function aspectsForPair(snapshots: EphemerisSnapshot[], sourceSlot: number, targetSlot: number) {
  const snapA = snapshots[sourceSlot];
  const snapB = snapshots[targetSlot];
  if (!snapA || !snapB) return [];
  return computeSynastryAspects({ snapshotsOrdered: [snapA, snapB], mode: 'pair' });
}

function directedForPairSection(snapshots: EphemerisSnapshot[], src: number, tgt: number) {
  return aspectsForPair(snapshots, src, tgt).filter(
    (a) => a.sourceSlotIndex === src && a.targetSlotIndex === tgt
  );
}

function selectWithClaim(
  aspects: ReturnType<typeof computeSynastryAspects>,
  src: number,
  tgt: number,
  claimed: Set<string>
) {
  const directed = aspects.filter((a) => a.sourceSlotIndex === src && a.targetSlotIndex === tgt);
  const qualifying: Array<{ pairField: string; aspectKey: string }> = [];
  for (const asp of directed) {
    const q = aspectQualifies(asp);
    if (!q.ok || !q.pairField) continue;
    qualifying.push({ pairField: q.pairField, aspectKey: buildAspectKey(asp.bodyA, asp.bodyB, asp.type) });
  }
  const availableAfterClaim = qualifying.filter((q) => !claimed.has(q.pairField));
  const selected: string[] = [];
  for (const q of availableAfterClaim) {
    if (selected.length >= SANDBOX_SYNASTRY_MAX_ACTIVATIONS_PER_PAIR) break;
    selected.push(q.pairField);
    claimed.add(q.pairField);
  }
  return { directedCount: directed.length, qualifyingCount: qualifying.length, availableAfterClaim: availableAfterClaim.length, selected };
}

function pairLabel(a: number, b: number, names: string[]) {
  return `${names[a]} + ${names[b]}`;
}

function main() {
  const snapshots = [snap(0), snap(1), snap(2)];
  const names = ['Nickster', 'Wizbiz', 'Nico'];
  const participants = names.map((label, i) => ({ slotIndex: i, label }));

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) pairs.push([i, j]);

  console.log('[audit] mode=group participants=3 unorderedPairs=', pairs.length);

  const pairStrengths = pairs.map(([a, b]) => {
    const asp01 = directedForPairSection(snapshots, a, b);
    let strength = 0;
    for (const asp of asp01) {
      const q = aspectQualifies(asp);
      if (q.ok) strength += typeof asp.exactness === 'number' ? asp.exactness : 0;
    }
    return { a, b, strength, directedCount: asp01.length };
  });
  pairStrengths.sort((x, y) => y.strength - x.strength);
  console.log('[audit] pairStrengths order:', pairStrengths.map((p) => `${pairLabel(p.a, p.b, names)} strength=${p.strength.toFixed(2)} directed=${p.directedCount}`));

  const allPairFields = new Set<string>();
  for (const [a, b] of pairs) {
    for (const asp of directedForPairSection(snapshots, a, b)) {
      const q = aspectQualifies(asp);
      if (q.ok && q.pairField) allPairFields.add(q.pairField);
    }
  }
  console.log('[audit] unique insight.pair fields across all 3 chart-pairs (one direction each):', allPairFields.size);

  const claimed = new Set<string>();
  for (const { a, b } of pairStrengths) {
    const asp = aspectsForPair(snapshots, a, b);
    const r = selectWithClaim(asp, a, b, claimed);
    const sectionProduced = r.selected.length > 0;
    console.log(
      `[audit] ${pairLabel(a, b, names)}: directed=${r.directedCount} qualifying=${r.qualifyingCount} afterGlobalClaim=${r.availableAfterClaim} selected=${r.selected.length} keys=${r.selected.join(',') || '(none)'} section=${sectionProduced ? 'YES' : 'SKIP'}`
    );
  }
  console.log('[audit] total claimed pair fields:', claimed.size);

  console.log('\n[audit] --- contrast: group_matrix precompute (correct global slot indices) ---');
  const matrix = computeSynastryAspects({ snapshotsOrdered: snapshots, mode: 'group_matrix' });
  const claimed2 = new Set<string>();
  for (const { a, b } of pairStrengths) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const pairAsp = matrix.filter((x) => {
      const xLo = Math.min(x.sourceSlotIndex, x.targetSlotIndex);
      const xHi = Math.max(x.sourceSlotIndex, x.targetSlotIndex);
      return xLo === lo && xHi === hi;
    });
    const directed = pairAsp.filter((x) => x.sourceSlotIndex === a && x.targetSlotIndex === b);
    const r = selectWithClaim(pairAsp, a, b, claimed2);
    console.log(
      `[audit-matrix] ${pairLabel(a, b, names)}: matrixForPair=${pairAsp.length} directed=${directed.length} afterClaim=${r.availableAfterClaim} section=${r.selected.length > 0 ? 'YES' : 'SKIP'}`
    );
  }
}

main();
