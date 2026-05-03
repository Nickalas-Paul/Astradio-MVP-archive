# Synastry S3 — Mode 2 deliverable (Community Feed expanded — group compose, two natals)

**Branch:** `beta-ui-vercel`. **Scope:** `runAggregateComposition` with **`kind: 'group'`** and **exactly two** ordered natal snapshots computes **`computeSynastryAspects({ snapshotsOrdered, mode: 'pair' })`** and passes **`pair_interaction_aspects`** into **`buildCanonicalReportForAggregate`**. Transit stays in **`relational_weather`** only; synastry ignores **`relationalWeather`** at compute time. Mode 3 (`group_matrix`, N≥3) and Mode 4 (sandbox-specific wiring) are **out of scope**.

---

## Files modified

| File | Change |
|------|--------|
| `vnext/api/compose.ts` | Participant-count branching in **`runAggregateComposition`**: comparison unchanged; group + **2** snapshots → pair synastry; group + **0–1** → no synastry; group + **≥3** → omit synastry (Mode 3). |
| `vnext/scripts/synastry-fixture-pre-post.ts` | Export **`snapshotFromLongitudes`**, **`projectComparisonAsync`**, **`MODE1_COMPARISON_FIXTURES`**; guard **`main()`** with **`require.main === module`** so Mode 2 script can import without running Mode 1 output. |
| `vnext/scripts/synastry-s3-mode2-pre-post.ts` | New fixture runner: group surface + weather, pre/post synastry; single-chart determinism; Mode 1 post-synastry control block. |
| `package.json` | Script **`fixture:synastry-s3-mode2-pre-post`**. |
| `docs/SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json` | Committed inspection output. |
| `docs/SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.md` | Summary table + regeneration notes. |

---

## Compose branching (explicit)

In **`runAggregateComposition`** (see comment block in source):

1. **`kind === 'comparison'`** — always **`computeSynastryAspects({ snapshotsOrdered: [snapLow, snapHigh], mode: 'pair' })`** (Mode 1; unchanged).
2. **`kind === 'group'`** and **`snapshotsOrdered.length === 2`** — same primitive: **`mode: 'pair'`** on those two natals (feed expanded / pair-shaped group).
3. **`kind === 'group'`** and **`snapshotsOrdered.length < 2`** — no synastry (graceful).
4. **`kind === 'group'`** and **`snapshotsOrdered.length >= 3`** — no synastry in this phase; **`pair_interaction_aspects`** omitted → assembler anchor-natal fallback (pre-S3-style for large groups).

**Projection:** **`insightProjectionOptionsFromCanonical`** already sets **`synastry_context`** to **`pair_comparison`** when participants ≤ 2 and synastry hits exist, and **`group_aggregate`** when > 2.

---

## Transit and weather (independence)

- **`computeSynastryAspects`** is called **only** with the two natal **`snapshotsOrdered`** entries. **`relationalWeather`** is **not** an input to synastry.
- **`relationalWeather`** continues to attach via **`buildCanonicalReportForAggregate`** and **`mergeRelationalWeatherIntoPlanChartContext`** on the plan side as before — parallel pipelines.

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc -p vnext/tsconfig.json --noEmit` | PASS |
| `npm run test:synastry-compute` | PASS |
| `npm run test:unified-projection` | PASS (full chain); **no** temporary skips |
| Single-chart gate | Fixture JSON: **`singleChartProjectionRepeatedIdentical: true`** (two runs of the same profile projection, identical JSON). |
| Mode 1 stability | **Verified:** `node scripts/diff-mode1-control-json.mjs` — **`postSynastry`** matches **`mode1ComparisonPostSynastryControl`** for all three fixtures (byte-identical `JSON.stringify`). No comparison-path drift from Mode 2 wiring. *(Initial manual compare failed only because **`SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json`** had been saved as UTF-16 with mojibake in curly quotes for fixture 2; **`cmd /c "node dist/vnext/vnext/scripts/synastry-fixture-pre-post.js > docs/SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json"`** refreshed UTF-8 output — procedural doc hygiene, not a code change.)* |
| Mode 2 fixtures | Three rows in **`SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.md`**: **`aspectSource: synastry`** post; **`signaturesChanged: true`**; **`relationalFieldChanged: false`**; **`relationalWeatherChanged: false`**. |

**Golden / Mode 2 fixtures:** No golden regeneration. If a future golden includes Mode 2-specific payloads, failures should be documented rather than refreshed until S4.

---

## Structural notes

- Group compose **shares** **`runAggregateComposition`** with comparison; Mode 2 only adds the **group + two-natal** synastry branch. No ephemeris or discovery-layer changes.
- Importing **`synastry-fixture-pre-post`** required **`require.main === module`** so helper exports do not execute Mode 1 **`main()`** (otherwise stdout would mix two fixture JSON objects).

---

## Review gate

Before Mode 3: inspect **`docs/SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json`**, confirm participant-count branching in **`compose.ts`**, and approve.

**Mode 2 closure:** Mode 1 control diff vs Mode 1 fixture **`postSynastry`** — **pass**. Cleared to proceed with Mode 3 wiring when ready.
