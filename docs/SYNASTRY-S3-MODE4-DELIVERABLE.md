# S3 Mode 4 — Deliverable summary (Sandbox synastry + R2 + R4)

Branch intent: **`beta-ui-vercel`**. Synastry wiring remains additive; asteroid handling is messaging-only.

## Subsection A — Synastry wiring (sandbox effective snapshots)

### Files (verification-first)

- **`vnext/api/sandbox-composition-execute.ts`** — No change to how `runAggregateComposition` receives snapshots. Pair and group branches already call `resolveSandboxSlotToOverriddenSnapshot` before `runAggregateComposition`, so **synastry runs on override-adjusted positions** whenever overrides exist. No extra compose-layer branching was required for Mode 4.

### Confirmation

- **Pair / group:** `computeSynastryAspects` in `runAggregateComposition` operates on `snapLow`/`snapHigh` or `snapshotsOrdered` exactly as produced by the sandbox resolver (with `generateSnapshotWithOverrides`).
- **Single-chart sandbox:** Still no `pair_interaction_aspects` / pair synastry surface (unchanged).

### Fixture inspection (`docs/SYNASTRY-S3-MODE4-FIXTURE-OUTPUT.json`)

| Fixture | aspectSource (post) | synastry_context | Notes |
|--------|----------------------|------------------|-------|
| `mode4_sandbox_pair_no_overrides` | synastry | pair_comparison | Aligns with Mode 1 fixture_1-style snapshots |
| `mode4_sandbox_pair_with_overrides` | synastry | pair_comparison | `overrideSynastryDiffersFromDb: true` — DB vs effective hit counts differ |
| `mode4_sandbox_group_three_with_overrides` | synastry | group_aggregate | Group matrix; Mars shifted on one member |
| `mode4_sandbox_pair_birth_only` | synastry | pair_comparison | Birth-only IDs; classification path N/A (no chart rows) |

**Diff flags:** `signaturesChanged: true` post- vs pre-synastry where pre used anchor natal; **`relationalFieldChanged` / `relationalWeatherChanged` false** for the listed pair/group rows — compartmentalization holds at text layer for these fixtures.

---

## Subsection B — R2 `commit_relational_classification`

### Files

- **`vnext/api/sandbox-composition-normalize.ts`** — `commit_relational_classification` on input (default `false`); included in **`canonical_input_hash`** via **`CANONICAL_INPUT_HASH_VERSION` → 4** (`vnext/api/sandbox-determinism.ts`).
- **`vnext/api/sandbox-composition-execute.ts`** — `computeCompatibilitySystem` runs only when **`commit_relational_classification === true`** and **both** slots have **`chart_id`** (existing chart-ID gate retained).

### Preview vs commit UX (deferred item 3)

**Decision:** **Omit classification on preview** — no “Preview” badge on stale classification. Preview resolves pass **`compatClassCode` omitted** to aggregate projection unless the user explicitly checks **Commit relational classification** (pair aggregate with two stored charts only).

**Reasoning:** Unambiguous semantics; avoids implying freshness when the wheel or pairing changed. Users who want Friend/Lover classification opt in via the checkbox before **Generate**.

### Client wiring

- **`apps/web/src/types/sandbox.ts`** — optional `commit_relational_classification` on composition input state.
- **`apps/web/src/lib/sandbox-composition-state.ts`** — `set_commit_relational_classification`; **`serializeSandboxResolveRequestBody`** sends `commit_relational_classification: true` only when enabled.
- **`apps/web/src/lib/sandbox-resolve-fingerprint.ts`** — fingerprint includes the commit flag so staleness detection tracks preview vs commit intent.
- **`apps/web/app/sandbox/page.tsx`** — checkbox when **two occupied slots are both `chart_id`** (no mixed birth wire).

### Cache / replay (proposal v2 §8)

The last resolve body stored for replay includes **`commit_relational_classification` only when true**, so replay reproduces the same classification gate as the session that generated it.

### Fixture note

The committed JSON uses library code **`cohesive_field`** for the **commit** projection row because **`computeCompatibilitySystem`** may require a live relational/Postgres path in some environments. The **engine gate** (preview skips `computeCompatibilitySystem`) is validated in code; full classification values vary with stored vectors.

---

## Subsection C — R4 Asteroid notice

### Files

- **`vnext/api/sandbox-composition-execute.ts`** — `synastryNoticeForAsteroidLongitudeOverrides`: any populated slot’s **`overrides.planets`** key intersecting **`ADDITIONAL_BODIES`** → response metadata.
- **`vnext/api/sandbox-routes.ts`** — forwards **`synastryNotice`** on successful resolve JSON.
- **`apps/web/app/sandbox/page.tsx`** — inline non-modal notice under the wheel when **`synastryNotice === 'asteroids_excluded_v1'`**, copy per proposal v2 §5:

  *“Asteroid placements aren't included in relationship-aspect lines yet. Sun-Pluto positions drive those lines.”*

### Pipeline

No asteroid stripping; **`generateSnapshotWithOverrides`** unchanged. Synastry remains **core-body scoped** (existing `CORE_BODIES` filter in compute).

### Fixture (`subsectionC_asteroidNotice`)

Detection matches **override on asteroid** only; chart natal Chiron without override does not set the flag.

---

## Cross-subsection

| Check | Result |
|--------|--------|
| Modes 1–3 control blocks in fixture JSON | Present (`mode1ComparisonPostSynastryControl`, `mode2GroupTwoChartsPostSynastryControl`, `mode3GroupThreeChartsPostSynastryControl`) |
| Single-chart byte-identical | `singleChartProjectionRepeatedIdentical: true` |
| `tsc -p vnext/tsconfig.json --noEmit` | Pass |
| `npm run test:synastry-compute` | Pass |
| `npm run test:unified-projection` | Pass (all scripts green) |

### Structural notes

- **`CANONICAL_INPUT_HASH_VERSION` bumped to 4** — any persisted sandbox fingerprints that depend on the hash will change when the commit flag is part of the payload; intentional for distinguishing preview vs commit resolves.

---

## Review gate

Mode 4 completes **S3**. Next: **S4** (golden hash regeneration) or **S5** (verification / R3 library audit and duplicate-key & natal-prose follow-ups) per v3 phase plan.
