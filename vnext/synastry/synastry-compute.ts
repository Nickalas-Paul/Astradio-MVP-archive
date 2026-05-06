/**
 * Pure synastry aspect computation for projection (S2). No I/O.
 *
 * ## R1 deterministic tiebreaker key (full format)
 *
 * Used when exactness, priorityBase, and orb are all tied between two hits. Lexicographic **ascending**
 * order on this string means **better** rank (sort key ascending = stronger placement in desc-quality sort).
 *
 * Format (pipe-separated, all ASCII lowercase except digits):
 *
 * `p{pairIdx}|s{srcSlot}|t{tgtSlot}|{bodySrc}|{bodyTgt}|{aspectType}`
 *
 * - **pairIdx**: 3-digit zero-padded decimal index of the **unordered** chart pair in scan order:
 *   nested loops `for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)`, first pair `p000`,
 *   second `p001`, … . Same chart slots always produce the same pairIdx regardless of directed sweep order.
 * - **srcSlot**: source chart slot index (0-based), where **bodySrc** longitude is read.
 * - **tgtSlot**: target chart slot index (0-based), where **bodyTgt** longitude is read.
 * - **bodySrc**, **bodyTgt**: lowercase canonical names from `CORE_BODIES` (`sun` … `pluto`), **directed**:
 *   bodySrc is on srcSlot, bodyTgt on tgtSlot (not alphabetically sorted — preserves Sun(A)→Moon(B) vs Moon(A)→Sun(B)).
 * - **aspectType**: lowercase `AspectTypeKey` string (`conjunction`, `square`, …).
 *
 * **Pair mode** (exactly two snapshots): only unordered pair `p000`, slots `s0|t1` and `s1|t0` for the two directed sweeps.
 *
 * **Examples:**
 * - `p000|s0|t1|sun|moon|conjunction` — Sun on chart 0 to Moon on chart 1, conjunction.
 * - `p001|s1|t2|mars|venus|square` — group with ≥3 charts; second unordered pair (slots 1 & 2).
 */

import { ASPECT_CONFIG, type AspectTypeKey } from '../aspect-engine';
import { bodyOrderIndex } from '../canonical-bodies';
import { CORE_BODIES, type BodyKey } from '../canonical-bodies';
import type { EphemerisSnapshot } from '../contracts';
import { findBestDirectedCrossAspect } from './cross-chart-best-aspect';
import type { DirectedSnapshotAspect } from './synastry-types';

export type SynastryComputationMode = 'pair' | 'group_matrix';

const SYNASTRY_GROUP_CAP = 32;

export type ComputeSynastryAspectsParams = {
  snapshotsOrdered: EphemerisSnapshot[];
  mode: SynastryComputationMode;
};

function lonByBody(snapshot: EphemerisSnapshot): Map<string, number> {
  const out = new Map<string, number>();
  for (const planet of snapshot.planets || []) {
    if (!planet?.name) continue;
    const lon = planet.lon;
    if (typeof lon !== 'number' || Number.isNaN(lon) || !Number.isFinite(lon)) {
      console.warn('[synastry-compute] skip planet with invalid longitude', planet.name);
      continue;
    }
    out.set(String(planet.name).toLowerCase(), lon);
  }
  return out;
}

function priorityBaseForHit(sourceBody: string, targetBody: string, exactness: number): number {
  const orderA = bodyOrderIndex(sourceBody);
  const orderB = bodyOrderIndex(targetBody);
  const importance = 1 - (orderA + orderB) / (2 * 20);
  return Math.max(0, Math.min(1, exactness * 0.7 + importance * 0.3));
}

/**
 * @see file header — ascending lex order = better rank when earlier comparators tie.
 */
export function buildSynastryDeterministicKey(params: {
  pairIndex: number;
  sourceSlot: number;
  targetSlot: number;
  sourceBody: BodyKey;
  targetBody: BodyKey;
  aspectType: AspectTypeKey;
}): string {
  const pi = String(params.pairIndex).padStart(3, '0');
  return `p${pi}|s${params.sourceSlot}|t${params.targetSlot}|${params.sourceBody}|${params.targetBody}|${params.aspectType}`;
}

type RankedHit = {
  snapshotRow: DirectedSnapshotAspect;
  exactness: number;
  priorityBase: number;
  orb: number;
  tieKey: string;
};

function compareRanked(a: RankedHit, b: RankedHit): number {
  if (b.exactness !== a.exactness) return b.exactness - a.exactness;
  if (b.priorityBase !== a.priorityBase) return b.priorityBase - a.priorityBase;
  if (a.orb !== b.orb) return a.orb - b.orb;
  if (a.tieKey < b.tieKey) return -1;
  if (a.tieKey > b.tieKey) return 1;
  return 0;
}

function unorderedPairIndex(n: number, i: number, j: number): number {
  let idx = 0;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      if (a === i && b === j) return idx;
      idx++;
    }
  }
  throw new Error(`synastry: invalid pair (${i},${j}) for n=${n}`);
}

function collectDirectedHits(
  sourceSlot: number,
  targetSlot: number,
  pairIndex: number,
  sourceSnapshot: EphemerisSnapshot,
  targetSnapshot: EphemerisSnapshot
): RankedHit[] {
  const out: RankedHit[] = [];
  const sourceLon = lonByBody(sourceSnapshot);
  const targetLon = lonByBody(targetSnapshot);
  for (const sb of [...CORE_BODIES] as BodyKey[]) {
    const lonA = sourceLon.get(sb);
    if (lonA === undefined) continue;
    for (const tb of [...CORE_BODIES] as BodyKey[]) {
      const lonB = targetLon.get(tb);
      if (lonB === undefined) continue;
      const best = findBestDirectedCrossAspect(lonA, lonB);
      if (!best) continue;
      const cfg = ASPECT_CONFIG[best.type];
      const priorityBase = priorityBaseForHit(sb, tb, best.exactness);
      const tieKey = buildSynastryDeterministicKey({
        pairIndex,
        sourceSlot,
        targetSlot,
        sourceBody: sb,
        targetBody: tb,
        aspectType: best.type,
      });
      const dynamics = cfg.dynamics;
      const strength = Math.max(0, Math.min(1, best.exactness));
      const row: DirectedSnapshotAspect = {
        bodyA: sb,
        bodyB: tb,
        type: best.type,
        orb: Math.round(best.orb * 1e6) / 1e6,
        exactAngle: Math.round(best.exactAngle * 1e6) / 1e6,
        dynamics,
        strength: Math.round(strength * 100) / 100,
        exactness: Math.round(best.exactness * 100) / 100,
        priorityBase: Math.round(priorityBase * 100) / 100,
        sourceSlotIndex: sourceSlot,
        targetSlotIndex: targetSlot,
      };
      out.push({
        snapshotRow: row,
        exactness: best.exactness,
        priorityBase,
        orb: best.orb,
        tieKey,
      });
    }
  }
  return out;
}

/**
 * Compute cross-chart synastry aspects for projection. Returns directed rows (`sourceSlotIndex` / `targetSlotIndex`).
  * - **pair**: exactly two snapshots; both directed sweeps (0→1 and 1→0).
  * - **group_matrix**: full pairwise matrix; ranked and capped at 32 (R1).
  */
export function computeSynastryAspects(params: ComputeSynastryAspectsParams): DirectedSnapshotAspect[] {
  const { snapshotsOrdered, mode } = params;
  const n = snapshotsOrdered.length;

  if (mode === 'pair') {
    if (n !== 2) {
      console.warn('[synastry-compute] pair mode expects 2 snapshots, got', n);
      return [];
    }
    const hits: RankedHit[] = [];
    hits.push(...collectDirectedHits(0, 1, 0, snapshotsOrdered[0]!, snapshotsOrdered[1]!));
    hits.push(...collectDirectedHits(1, 0, 0, snapshotsOrdered[1]!, snapshotsOrdered[0]!));
    hits.sort(compareRanked);
    return hits.map((h) => h.snapshotRow);
  }

  if (mode === 'group_matrix') {
    if (n < 2) {
      console.warn('[synastry-compute] group_matrix expects at least 2 snapshots, got', n);
      return [];
    }
    const hits: RankedHit[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pairIndex = unorderedPairIndex(n, i, j);
        hits.push(
          ...collectDirectedHits(i, j, pairIndex, snapshotsOrdered[i]!, snapshotsOrdered[j]!)
        );
        hits.push(
          ...collectDirectedHits(j, i, pairIndex, snapshotsOrdered[j]!, snapshotsOrdered[i]!)
        );
      }
    }
    hits.sort(compareRanked);
    const capped = hits.slice(0, SYNASTRY_GROUP_CAP);
    return capped.map((h) => h.snapshotRow);
  }

  console.warn('[synastry-compute] unknown mode', mode);
  return [];
}
