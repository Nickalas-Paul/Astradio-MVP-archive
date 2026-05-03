# Synastry S2 — Deliverable summary (core compute)

**Phase:** S2 — core compute (complete). **Proposal:** `docs/SYNASTRY-PROPOSAL.md` v2. **Branch:** `beta-ui-vercel`.

---

## Files created

| Path | Role |
|------|------|
| `vnext/synastry/cross-chart-best-aspect.ts` | Shared directed cross-chart geometry: `findBestDirectedCrossAspect`, `ASPECT_TYPE_ORDER_CROSS_CHART`. |
| `vnext/synastry/synastry-compute.ts` | `computeSynastryAspects`, `buildSynastryDeterministicKey`, R1 ranking + cap 32 for `group_matrix`. |
| `vnext/synastry/synastry-compute.test.ts` | Node `node:test` suite (`npm run test:synastry-compute`). |
| `docs/SYNASTRY-S2-DELIVERABLE.md` | This document. |

## Files modified (geometry extraction only)

| Path | Change |
|------|--------|
| `vnext/compatibility/build-relational-field.ts` | `computePairSignals` now calls `findBestDirectedCrossAspect` instead of duplicating orb/type loops. |
| `package.json` | Script `test:synastry-compute`. |

**No** projection, canonical report, compose, or UI paths import synastry-compute yet (S3 wiring).

---

## Public interface

```typescript
export type SynastryComputationMode = 'pair' | 'group_matrix';

export type ComputeSynastryAspectsParams = {
  snapshotsOrdered: EphemerisSnapshot[];
  mode: SynastryComputationMode;
};

export function computeSynastryAspects(params: ComputeSynastryAspectsParams): SnapshotAspect[];

/** Exported for tests and documentation parity with tiebreaker comparators. */
export function buildSynastryDeterministicKey(params: {
  pairIndex: number;
  sourceSlot: number;
  targetSlot: number;
  sourceBody: BodyKey;
  targetBody: BodyKey;
  aspectType: AspectTypeKey;
}): string;
```

```typescript
export function findBestDirectedCrossAspect(lonSource: number, lonTarget: number): DirectedCrossAspectHit | null;
```

---

## Deterministic key string format (R1 tiebreaker)

See module header comment in `synastry-compute.ts`. Summary:

- **`p{ddd}|s{slot}|t{slot}|{bodySrc}|{bodyTgt}|{type}`**
- **`pairIndex`:** three-digit zero-padded index of unordered chart pair in nested `(i,j)` scan order.
- **Bodies:** lowercase `CORE_BODIES` names in **directed** order (body on `sourceSlot`, body on `targetSlot`).
- **Example:** `p001|s1|t2|mars|venus|square`

---

## Test coverage (`synastry-compute.test.ts`)

| Behavior | Test |
|----------|------|
| Conjunction detection | `conjunction: same longitude for body pair across charts` |
| All five aspect types at tight orb | `five aspect types: geometry hits each type at tight orb` |
| Orb threshold edge (conj 8°) | `orb boundary: exact threshold qualifies, epsilon over threshold rejected` |
| Pair determinism | `pair mode determinism: identical outputs byte-identical` |
| Group cap 32 (3 charts) | `group matrix: identical snapshots across three charts yield many hits then cap 32` |
| Group cap 32 (4 charts) | `group matrix: four charts still caps at 32` |
| Exactness ranks conj above loose square | `ranking: 1° conjunction beats 6° square (exactness)` |
| priorityBase / luminaries | `tiebreak: priorityBase — same exactness favors luminaries (sun involved)` |
| Empty inputs | `empty: pair mode with one snapshot returns []`, `empty: group_matrix with zero snapshots returns []` |
| NaN longitude | `invalid longitude NaN: skips body, no throw` |
| Key format | `deterministic key format example` |

---

## Structural notes — `computePairSignals` extraction

- **No fork:** Orb/type resolution now delegates to `findBestDirectedCrossAspect`, matching previous behavior (min orb; tie `ASPECT_TYPE_ORDER_CROSS_CHART` index).
- **Downstream compatibility:** `NatalCrossSignal` still receives `best.type`, `best.exactness`; houses and campaign weights unchanged.

---

## S3 planning notes

- **Diagnostics:** Invalid planet longitudes use `console.warn('[synastry-compute]', …)` — acceptable for server; S3 may wrap behind logger if needed.
- **Pair vs group:** `pair` mode returns **all** directed hits (sorted, **uncapped**); `group_matrix` applies **cap 32**. Aligns with proposal v2 §7.
- **Imports:** Production wiring should import only from `synastry-compute.ts`; compatibility stays on `cross-chart-best-aspect` via `build-relational-field`.

---

## Verification commands

- `npx tsc -p vnext/tsconfig.json --noEmit`
- `npm run test:synastry-compute`
- `npm run test:unified-projection` (unchanged vs pre-S2)
