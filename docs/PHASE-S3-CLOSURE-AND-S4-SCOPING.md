# S3 closure confirmation and S4 scoping audit

Read-only audit on branch state at audit time (`beta-ui-vercel` as specified). No code changes, no golden regeneration, no fixture edits.

---

## Part 1 — S3 closure confirmation

Explicit **PASS** / **FAIL** / **PARTIAL** per verification item. Where the standalone Mode reference JSON is ambiguous, cross-mode artifacts (`SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json`, `SYNASTRY-S3-MODE4-FIXTURE-OUTPUT.json`) are treated as authoritative duplicates of Mode 1 / Mode 2 control blocks.

### Mode 1 — Static A+B comparison (`kind: 'comparison'`)

| Item | Status | Notes |
|------|--------|--------|
| Post-S3 output shows `aspectSource: "synastry"` for projection-facing synastry fields | **PASS** | Confirmed in embedded `mode1ComparisonPostSynastryControl` in `docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json` and `docs/SYNASTRY-S3-MODE4-FIXTURE-OUTPUT.json` (three fixtures each). |
| `aspectLibraryKeysFirst3` contains cross-chart keys (not single-chart-only anchor ordering) | **PASS** | Same sources: e.g. `SUN_MERCURY_OPPOSITION`, `MOON_MERCURY_SEXTILE`, etc. |
| Single-chart byte-identical / determinism gate | **PASS** | `singleChartProjectionRepeatedIdentical: true` in Mode 2–4 fixture JSON; standalone Mode 1 file is valid UTF-8 JSON (closure cleanup, May 2026). |
| Reference file `docs/SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json` | **PASS** | Regenerated from `synastry-fixture-pre-post.js` as UTF-8 without BOM; parses with `JSON.parse`; structural parity verified vs prior UTF-16 document (fixtures identical excluding `generatedAt`). **`scripts/diff-mode1-control-json.mjs`** confirms `postSynastry` slices match `mode1ComparisonPostSynastryControl` in Mode 2 JSON. Embedded Mode 3/4 Mode 1 controls additionally record `synastry_context` on `postSynastry`; standalone Mode 1 script output omits that field by design—compare Mode 2 embedded control for strict parity with the standalone Mode 1 file. |

**Mode 1 substantive closure:** **PASS** (including standalone reference path).

---

### Mode 2 — Community feed expanded, two-chart group (`kind: 'group'`, two snapshots)

| Item | Status | Notes |
|------|--------|--------|
| `synastry_context: "pair_comparison"` on post output | **PASS** | Standalone `docs/SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json` now includes `synastry_context: "pair_comparison"` on each `postMode2` and `synastry_context: null` on each `preMode2` (closure cleanup, May 2026). |
| `relationalWeatherChanged: false` (transit/weather independence) | **PASS** | `diffFlags.relationalWeatherChanged: false` on `mode2_feed_expanded_1` in `SYNASTRY-S3-MODE2-FIXTURE-OUTPUT.json`. |
| Mode 1 control block matched between fixture files | **PASS** | `mode1ComparisonPostSynastryControl` aligns across Mode 2, 3, and 4 JSON (same fixtures and postSynastry shapes). |

---

### Mode 3 — Group aggregate (`mode: 'group_matrix'`, cap 32, R1 ranking)

| Item | Status | Notes |
|------|--------|--------|
| `synastry_context: "group_aggregate"` on post output | **PASS** | `mode3GroupThreeChartsPostSynastryControl.postSynastry` in Mode 3 and Mode 4 fixtures. |
| Cap binds at 32 | **PASS** | `totalSynastryHitsInCanonical: 32` (Mode 4); Mode 3 lists `synastryMatrixHitCount: 32`. |
| R1 ranking | **PASS** | Covered by `npm run test:synastry-compute` (ranking / tiebreak subtests); fixture exposes consistent first-three keys. |
| Modes 1 and 2 control blocks matched | **PASS** | Embedded Mode 1 and Mode 2 sections present and consistent in Mode 3/4 JSON. |

---

### Mode 4 — Sandbox compose (overrides, R2, R4)

| Item | Status | Notes |
|------|--------|--------|
| `overrideSynastryDiffersFromDb: true` on with-overrides fixture | **PASS** | Present in `docs/SYNASTRY-S3-MODE4-FIXTURE-OUTPUT.json`. |
| R2 `commit_relational_classification` gate (code + fixture narrative) | **PASS** | Documented in fixture (`subsectionB_commitFlag`, `canonicalInputHashVersionNote`); behavior described in `docs/SYNASTRY-S3-MODE4-DELIVERABLE.md` and implemented in sandbox normalize/execute (prior deliverable; not re-audited line-by-line here). |
| R4 asteroid notice: triggers on override path, not merely natal presence | **PASS** | `subsectionC_asteroidNotice` distinguishes `asteroid_present`, `asteroid_absent`, `asteroid_in_chart_no_override` / `synastryNoticeFlag` behavior. |

---

### Cross-mode stability

| Item | Status | Notes |
|------|--------|--------|
| Prior modes’ control blocks stable across deliverables | **PASS** | Mode 1 and Mode 2 controls duplicated consistently in Mode 3 and Mode 4 JSON. |
| Single-chart byte-identical determinism across modes | **PASS** | Flag `singleChartProjectionRepeatedIdentical: true` in fixtures where recorded. |

---

### Test suite continuity

Commands requested: `tsc -p vnext/tsconfig.json --noEmit`, `npm run test:synastry-compute`, `npm run test:unified-projection`.

| Command | Result (audit run) |
|---------|---------------------|
| `npx tsc -p vnext/tsconfig.json --noEmit` | **PASS** (exit 0) |
| `npm run test:synastry-compute` | **PASS** (12 tests, 0 skipped) |
| `npm run test:unified-projection` | **PASS** (full chain including `vnext:build`, unified projection, gate A, phases 0–5 scripts as wired in `package.json`) |

No temporary skips observed in these runs.

---

### Part 1 summary — S3 “closed”?

- **Substantive S3 wiring and behavioral evidence:** **PASS** across Modes 1–4.
- **Documentation artifacts:** UTF-8 Mode 1 reference file and Mode 2 `synastry_context` capture addressed in closure cleanup (May 2026); Part 1 checklist items for Mode 1 and Mode 2 read as **PASS** without qualification.

---

## Part 2 — S4 scoping audit

### 1. Existing golden coverage

**Inside `npm run test:unified-projection` (primary CI-style gate):**

- **`vnext/eval/phase4-expression-golden-hashes.json`** — single hash `profile_extended_hash` for **profile extended** tier expression enforcement (`test-phase4-expression-enforcement.ts`). This locks **single-chart profile extended** surface behavior, not multi-chart synastry output.
- **`gate-a-projection-identity.ts`** — structural **identity** checks (section IDs, projection validation) for surfaces including `compat_pair` and `group` **baseline/extended**, built via `buildCanonicalReportForAggregate` with synthetic snapshots. It does **not** compare full canonical payload hashes or explanation text to a golden file for those surfaces.

**Outside unified-projection (npm scripts):**

- **`test-golden-compose.ts`** — sandbox compose `plan_sha256` / explanation hashes vs **`golden-compose-baseline.json`** (path next to eval). Baseline file **not present** in repo; running the script without `UPDATE_GOLDEN=1` exits with “No baseline found”.
- **`test-golden-compat.ts`** — `createComparison` → comparison path with fixed charts vs **`golden-compat-baseline.json`**. Same: **baseline not in repo**; would fail until baselines are generated.
- **`vnext/eval/golden-set.json`** — **input catalog** for compose scenarios (sandbox, sky, overlay): **single-chart / overlay**, not compat_pair or group_aggregate matrices.

**Surfaces with committed hash-like regression coverage today (unified-projection path):**

| Surface area | Golden / hash regression? |
|--------------|---------------------------|
| Profile extended (expression enforcement) | **Yes** — `profile_extended_hash` |
| Sandbox compose deterministic hashes | **Optional script only** — baseline absent |
| Comparison / compat_pair explanation | **Optional script only** — baseline absent |
| Group aggregate | **No** dedicated golden file |
| Sandbox multi-chart synastry | **No** |

---

### 2. Current test suite results — `npm run test:unified-projection`

**Result: PASS** (audit run). All chained steps reported OK:

- `test-unified-projection`
- `gate-a-projection-identity`
- `test-repetition-collapse-phase0`
- `test-phase1-claim-expression` … through `test-phase5-expression-filters`

**Failures:** none in this run.

**Interpretation:** No failures attributable to S3 synastry wiring surfaced in this suite; there is **nothing here that forces a golden “regeneration” step** for CI to stay green.

---

### 3. Hidden golden shifts

**Question:** Do goldens cover `runAggregateComposition` for compat_pair / group_aggregate in a hash-stable way?

- **Committed CI hash:** only **`profile_extended_hash`** (profile extended). S3 synastry wiring does not affect that single-chart profile extended hash unless profile pipeline changed; audit run **passed**, so no drift flagged there.

- **`test-golden-compat`:** would exercise aggregate/comparison plumbing and explanation hashing **if** `golden-compat-baseline.json` existed. It **does not** exist in-repo, so **no hidden drift** from missing baseline updates—the test is not enforcing a stored compat golden in CI.

- **`pair_interaction_aspects_digest`** in `vnext/canonical/object-identity-hash.ts` includes synastry payload when `pair_interaction_aspects` is non-null. Tests reviewed here **do not** assert a fixed `object_identity_hash` for aggregate reports against a checked-in expected value. **Risk:** canonical identity could change for comparison/group objects without a failing test **unless** some other assertion covers it. Current unified-projection suite **did not** expose such a gap as a failure.

**Conclusion:** Not observing “masked” golden drift for aggregate surfaces because **there is no committed aggregate hash baseline** in the paths audited. The profile extended golden is single-chart and remained stable across the passing run.

---

### 4. Coverage gaps for synastry-bearing surfaces

Synastry-driven output now affects comparison, two-chart group, group matrix, and sandbox pair flows (per S3 deliverables). **Regression locking:**

- **Docs fixtures** (`SYNASTRY-S3-MODE*-FIXTURE-OUTPUT.json`) are **manual inspection artifacts**, not CI tests.
- **No automated golden** compares compat_pair / group_aggregate / sandbox synastry projection strings or hashes in the default `test:unified-projection` pipeline.

**Gap:** Silent regressions in synastry wiring or relational library selection on multi-chart surfaces can ship without failing CI, unless caught by narrower unit tests (e.g. synastry-compute geometry/ranking) or manual fixtures.

---

### 5. S5 dependency assessment (ordering vs second regeneration)

S5 items: **R3 library content audit**, **duplicate-library-key behavior**, **natal-prose-on-synastry-keys resolution**.

| S5 item | Likely impact on committed goldens | Notes |
|---------|-------------------------------------|--------|
| R3 library content | **High** on compat/group/sandbox **text** | Library strings drive projection output on relational surfaces. |
| Duplicate-key behavior | **Medium–high** on multi-chart surfaces | Changes which lines win when keys collide. |
| Natal prose on synastry keys | **High** on multi-chart surfaces | Directly changes mixed natal/synastry reads. |

**`profile_extended_hash`:** could change if R3 or duplicate-key fixes alter shared literals used on profile extended; **less certain** than multi-chart impact.

**If** someone generates `golden-compose-baseline.json` / `golden-compat-baseline.json` **before** S5, those baselines would likely need **another** pass after S5 content fixes.

---

## S4 scope determination

**Classification: S4 minimal** (for the repository’s **current** CI-oriented definition of “golden” work).

**Reasoning:**

1. **`npm run test:unified-projection` passes** without any golden regeneration step after S3.
2. The only **checked-in** expression golden (`phase4-expression-golden-hashes.json`) targets **profile extended**, not synastry-bearing aggregate surfaces; it **still passes**.
3. **Compose / compat golden baselines are absent**; optional scripts fail fast until `UPDATE_GOLDEN=1`. There is **no** in-repo compat/group golden string hash that S3 invalidated.
4. Therefore **S4 does not block S5** on the grounds of “must regenerate goldens to restore CI,” unless the team **chooses** to introduce compose/compat baselines as new artifacts.

**Nuance:** If “S4” is defined as **creating** compose/compat baselines for the first time, that is **new coverage work**, not regeneration of previously committed hashes—and it would still be **highly likely to churn again** under S5 (**would have looked like “substantive and unstable”** relative to S5). Under the proposal’s framing (regeneration after wiring invalidates existing goldens), **S4 is effectively empty** for CI.

---

## Coverage gap recommendation (synastry-bearing surfaces)

**Recommendation:** Treat **adding automated regression coverage** for compat_pair / group / sandbox synastry-driven projection as a **separate work item**, preferably **after S5** (or in parallel with S5 library fixes) **unless** the team explicitly wants early guardrails before library churn settles.

**Tradeoff:** Cost is non-trivial (stable fixtures, hash or snapshot strategy, maintenance). Benefit is catching silent regressions in relational projection. **Deferring until post-S5** avoids writing goldens twice if textual/library outputs move under S5.

---

## Structural surprises vs proposal v2 phase plan

1. **Mode 1 fixture encoding** — Standalone Mode 1 JSON not UTF-8-safe for standard tooling; unexpected for a “reference diff” doc.
2. **Mode 2 standalone vs embedded** — `synastry_context` appears in embedded Mode 2 control (Mode 3/4) but not on standalone `postMode2` in Mode 2 JSON.
3. **Golden baselines missing** — “Golden regeneration phase” assumes existing baselines to refresh; compose/compat baselines are **not** checked in, so CI does not enforce them.
4. **Gate A exercises compat/group projection IDs** without hashing full canonical identity—synastry digest changes may **not** flip Gate A if section IDs stay stable.
5. **Synastry-compute tests** validate geometry/cap/ranking but **not** full narrative projection for aggregate surfaces.

---

## Decision input: S4 vs S5 ordering

On **audit evidence**, **no CI-blocking S4 regeneration is required** before S5. Proceeding to **S5 first** avoids duplicate baseline work if the team later adds compose/compat goldens. If product priority is **locking synastry projection hashes early**, that is **new** golden work with **high likelihood** of a **second** update after S5 library and prose fixes.
