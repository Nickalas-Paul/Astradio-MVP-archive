# Synastry S3 — Mode 1 deliverable (Static A+B comparison wiring)

**Branch:** `beta-ui-vercel`. **Scope:** `createComparison` → `runAggregateComposition` (`kind: 'comparison'`) → canonical → `insightProjectionOptionsFromCanonical` → `assemble-sections` aspect-library slice only. Modes 2–4 **not** wired.

---

## Files modified

| File | Change |
|------|--------|
| `vnext/canonical/canonical-report-object.ts` | Optional `pair_interaction_aspects?: readonly SnapshotAspect[]`. |
| `vnext/canonical/object-identity-hash.ts` | `pair_interaction_aspects_digest` in identity payload (stable JSON of aspects list). |
| `vnext/canonical/build-from-compose-context.ts` | `buildCanonicalReportForAggregate` accepts optional `pair_interaction_aspects`; merged into report before hash. |
| `vnext/projection/projection-types.ts` | `pairInteractionAspects?`, `synastry_context?` on `ProjectionOptions`. |
| `vnext/projection/insight-projection-from-canonical.ts` | Maps non-empty canonical synastry to projection options; `synastry_context` is `pair_comparison` when ≤2 participants, `group_aggregate` when >2 (future group synastry). |
| `vnext/projection/rule-layer/assemble-sections.ts` | `aspectsForInsightLibraryLookup()` — prefer synastry, else anchor natal. |
| `vnext/api/compose.ts` | `runAggregateComposition`: for `comparison`, `computeSynastryAspects([snapLow, snapHigh], 'pair')` then pass into aggregate builder. |

**Default behavior:** All new fields optional / omitted on single-chart and on aggregates built without synastry (scripts, intent helpers, gate tests).

---

## Type signatures (additive)

- **`CanonicalReportObject.pair_interaction_aspects`** — Omitted when not computed. May be `[]` when comparison compose ran synastry and found zero in-orb hits (identity digest still reflects `[]`).
- **`ProjectionOptions.pairInteractionAspects`** — Omitted when canonical synastry missing or **length 0** (never pass empty array — assembler fallback).
- **`ProjectionOptions.synastry_context`** — Set only when `pairInteractionAspects` is passed with length ≥ 1.

---

## Wiring: `runAggregateComposition` → projection

1. **`input.kind === 'comparison'`** → `pairInteractionAspects = computeSynastryAspects({ snapshotsOrdered: [input.snapLow, input.snapHigh], mode: 'pair' })` using the **same** `snapLow` / `snapHigh` as participant slots (lexical low/high chart ordering from callers).
2. **`buildCanonicalReportForAggregate({ ..., pair_interaction_aspects })`** stores result on the canonical report (including empty array).
3. **`interpretCanonicalReportObject`** unchanged (synastry not on SemanticCore).
4. **`insightProjectionOptionsFromCanonical`** — if `participants.length >= 2` and `pair_interaction_aspects?.length > 0`, adds `pairInteractionAspects` + `synastry_context`; always still passes **anchor** `snapshotAspects` for fallback paths.
5. **`assemble-sections`** MEP block uses **`aspectsForInsightLibraryLookup(options)`** → synastry first, else anchor natal.

---

## `assemble-sections` branch (explicit order)

1. If `options.pairInteractionAspects` is **defined** and **length ≥ 1** → use it for `buildAspectKey` / aspect insights (max 3 slices as before).
2. Else → `options.snapshotAspects ?? []` (anchor natal), identical to pre-S3 behavior.
3. **No double-render:** only one list feeds `rawAspects` per section build.

---

## Empty-hit fallback (deferred item 4 — resolved)

| Topic | Decision |
|-------|-----------|
| **Trigger** | Use anchor natal aspects when **either**: (a) `pairInteractionAspects` is **omitted** from `ProjectionOptions`, or (b) it would be empty — implemented by **omitting** the key when synastry has zero hits (`insightProjectionOptionsFromCanonical`), so the assembler sees only `snapshotAspects`. Canonical may still hold `pair_interaction_aspects: []` for auditing/identity. |
| **Fallback path** | Anchor participant `natal_snapshot.aspects` via existing `snapshotAspects` in options (unchanged from Phase A wiring). |
| **User-facing signal** | **None** when fallback runs — output matches previous **anchor-only** aspect library behavior (Mode 1 indistinguishable from legacy when synastry empty). |
| **Reasoning** | Avoids silent regression for pairs with no qualifying cross-aspects; matches product expectation that “no synastry line” isn’t an error state. |

---

## Single-chart byte-identical gate

**Verification:** `test-unified-projection.ts` exercises **only** `buildCanonicalReportForSnapshotSurface` + `projectTextFromSemanticCore` **without** passing explicit aspect options — same as pre-S3. **Assertion:** `JSON.stringify` determinism of two projection runs — **unchanged**.

**Result:** `npm run test:unified-projection` **PASS** — including `test-unified-projection.js` (single-chart smoke).

**Note:** `gate-a-projection-identity` builds aggregate via **`buildCanonicalReportForAggregate` directly** (no compose), so **no** `pair_interaction_aspects` — compat/group structural checks unchanged. **Production** comparisons via **compose** pick up synastry.

---

## Mode 1 qualitative verification (manual)

**Automated gate:** Does not assert synastry copy semantics.

**Committed inspection (current branch):** Three synthetic Static A+B pairs with **pre-S3** (no `pair_interaction_aspects` / anchor natal for aspect library) vs **post-S3** (synastry list) side-by-side JSON: **`docs/SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.json`**, summary **`docs/SYNASTRY-S3-MODE1-FIXTURE-OUTPUT.md`**. Regenerate: **`npm run fixture:synastry-s3-pre-post`** (stdout or redirect to refresh the JSON).

**Criteria:** For each fixture, `aspectLibraryKeysFirst3` and **`aspectSource`** (`anchor_natal` vs `synastry`) should differ when synastry hits exist; aspect-library **`signatures`** prose should change when top keys differ. **`relational_field`** may stay identical when copy is template-driven.

**Additional manual pass:** Run **`createComparison`** / compose API with two **materially different** saved charts (distinct longitudes), inspect **`signatures`** / MEP-adjacent aspect library blurbs on **`compat_pair`**.

**Fixtures used elsewhere (not golden tests):**

1. **Gate `coreCompat`** (`snap(0)` vs `snap(5)`) — gate script **does not** attach synastry → legacy behavior.
2. **Compose comparison** — synastry computed from `snapLow`/`snapHigh` in production compose.

**Semantic risk:** Insight library prose is still **keyed by body pair + aspect type**; cross-chart vs natal may read similarly until Tier 1 audit (S5).

---

## Test / golden status

| Suite | Result |
|-------|--------|
| `npm run test:synastry-compute` | PASS |
| `npm run test:unified-projection` | **PASS** (full chain) |
| Temporary skips | **None** — golden regeneration deferred to S4 per plan |

---

## Structural surprises

- None — `computeSynastryAspects` integrates as a pure pre-canonical step; identity hash extended explicitly for synastry payloads.

---

## Follow-ups (later prompts)

- Mode 2–4 wiring, R2/R4, sandbox **`sandbox_override`** discriminator on canonical when needed.
- S4 golden refresh after all modes.
