# Synastry S3 — Mode 3 deliverable (group aggregate, three or more natals)

**Branch:** `beta-ui-vercel`. **Scope:** `runAggregateComposition` with **`kind: 'group'`** and **three or more** ordered natal snapshots computes **`computeSynastryAspects({ snapshotsOrdered, mode: 'group_matrix' })`** and passes **`pair_interaction_aspects`** into **`buildCanonicalReportForAggregate`** on the same path as Mode 1 (comparison / pair) and Mode 2 (group with two natals). The cap of 32 and R1 ranking remain **inside** `computeSynastryAspects`; the wiring layer does not re-implement them. Mode 4 (sandbox) is **out of scope**.

---

## Files modified

| File | Change |
|------|--------|
| `vnext/api/compose.ts` | Extended participant-count branching: **`kind: 'group'`** and **`snapshotsOrdered.length >= 3`** → **`group_matrix`** synastry attached as **`pair_interaction_aspects`**. |
| `vnext/scripts/synastry-s3-mode2-pre-post.ts` | Export **`mkPairWeather`**, **`projectGroupFeedExpandedAsync`**, **`MODE2_FIXTURES`**; return optional **`synastry_context`** on projection helper for control blocks. |
| `vnext/scripts/synastry-fixture-pre-post.ts` | Return optional **`synastry_context`** on **`projectComparisonAsync`** for Mode 1 control parity. |
| `vnext/scripts/synastry-s3-mode3-pre-post.ts` | **New** fixture runner: three group fixtures (3 / 4 / 6 charts), pre/post, Mode 1 & Mode 2 post-synastry controls, discriminator capture. |
| `package.json` | Script **`fixture:synastry-s3-mode3-pre-post`**. |
| `docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json` | Committed inspection output (UTF-8; regenerate via CMD redirect on Windows — see fixture markdown). |
| `docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.md` | Summary table + regeneration notes. |

---

## Compose branching (explicit)

In **`runAggregateComposition`**:

1. **`kind === 'comparison'`** — **`computeSynastryAspects({ snapshotsOrdered: [snapLow, snapHigh], mode: 'pair' })`** (Mode 1; unchanged).
2. **`kind === 'group'`** and **`snapshotsOrdered.length === 2`** — **`mode: 'pair'`** (Mode 2; unchanged).
3. **`kind === 'group'`** and **`snapshotsOrdered.length < 2`** — no synastry (unchanged).
4. **`kind === 'group'`** and **`snapshotsOrdered.length >= 3`** — **`computeSynastryAspects({ snapshotsOrdered, mode: 'group_matrix' })`** (Mode 3).

**Projection:** **`insightProjectionOptionsFromCanonical`** sets **`synastry_context`** to **`pair_comparison`** when there are exactly two participants and non-empty synastry, and **`group_aggregate`** when there are **more than two** participants and non-empty synastry — Mode 3 is the first wiring path that exercises **`group_aggregate`** in production-shaped output.

---

## Verification

| Check | Result |
|--------|--------|
| `tsc -p vnext/tsconfig.json --noEmit` | Pass |
| `npm run test:synastry-compute` | Pass (12 tests) |
| `npm run test:unified-projection` | Pass (full chain) |
| Single-chart fixture diff (pre vs post in script) | Empty (`singleChartProjectionRepeatedIdentical: true`) |
| Mode 1 control | JSON **`mode1ComparisonPostSynastryControl`** — compare to Mode 1 fixture `postSynastry` slices (same helpers as Mode 1 script). |
| Mode 2 control | JSON **`mode2GroupTwoChartsPostSynastryControl`** — `mode2_feed_expanded_1`, **`synastry_context: pair_comparison`**. |
| Mode 3 fixtures | **`aspectSource: synastry`**, **`synastry_context: group_aggregate`**, **`totalSynastryHitsInCanonical` ≤ 32**, **`signaturesChanged: true`**, **`relationalFieldChanged: false`**, **`relationalWeatherChanged: false`**. |
| Temporary test skips | None added |

### Cap and ranking (fixture observations)

- All three Mode 3 synthetic groups produced **32** synastry rows after cap — the **cap binds** for these longitudes (including the smallest three-chart case).
- Top **`aspectLibraryKeysFirst3`** entries are **body–body–type** keys only; duplicate keys (e.g. repeated **`SUN_SUN_OPPOSITION`**) are consistent with multiple directed or multi-pair hits sharing the same insight key — they do **not** by themselves prove non-anchor pair diversity (use internal R1 tie keys for pair-index debugging if needed).

### Structural notes

- No new canonical fields and no new projection-options fields; **`pair_interaction_aspects`** shape unchanged (**`SnapshotAspect[]`**).
- Group-matrix mode interacts with projection the same way as pair synastry: non-empty list drives **`pairInteractionAspects`** + **`synastry_context`**; empty or omitted list falls back to anchor natal aspects per existing assembler rules.

---

## Review gate

Mode 3 fixture output in **`docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json`** should be inspected for cap behavior vs proposal v2 §7 and approved before Mode 4 (sandbox) wiring.
