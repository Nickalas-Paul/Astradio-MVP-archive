# S5 Stage A — Pre-prompt audit (read-only)

**Branch context:** `beta-ui-vercel` (per carried constraints).  
**Scope:** Repository state only — no behavior changes, no new specs, no new tests.  
**Verify commands (reference):** `tsc -p vnext/tsconfig.json --noEmit`, `npm run test:unified-projection`.

---

## Audit Area 1 — Suppression, fallback, policy, configuration, tests

### 1.1 Per-key / per-claim “kill-list” or suppression in the assembler

**Finding:** There is **no** first-class mechanism to mark an aspect-library key, claim id, or arbitrary content fragment as “suppressed” or kill-listed for the MEP insight-library slice or elsewhere in `assemble-sections.ts`.

**What exists instead (related but not kill-list):**

| Mechanism | Location | Role |
|-----------|----------|------|
| **Claim-id de-duplication within a section group** | `appendSectionGroupTagged` in `vnext/projection/rule-layer/assemble-sections.ts` | For blocks with `provenance === 'claim_body'`, if every `claim_id` in the block was already `usedWithinGroup`, the block is **skipped** (no re-append of the same claim ids). This is **claim-id** scoped, not aspect-library-key scoped. |
| **Sandbox section strip set** | `SANDBOX_STRIP_SECTION_IDS` + `filterAndOrderPhase3Sections` in `assemble-sections.ts` | Hard-coded `Set` of **section ids** removed for `surface === 'sandbox'` only — not per-aspect keys. |
| **Campaign title suppression** | `suppressAstrologyTitles: surface === 'campaign'` in `assemblePhaseDSections` / `apply-unified-projection` | Renames template **titles** and related glue via `template-lines.ts` and `phase2-sentence-load.ts` — not content kill-list. |
| **Sparse compat synthesis body emptying** | `assemble-sections.ts` (`sparseCompat` branches for `synthesis_a` / `synthesis_b` / `interaction_map`) | Conditional **empty** `synBody` for specific surfaces/tiers — policy-like gating, not configurable key list. |

**Aspect-library path (signatures / MEP):** The only “gate” on library material is the combination of **source list** (`aspectsForInsightLibraryLookup`), **slice(0, 3)**, **`getAspectInsight`**, and **`.filter((ins): ins is AspectInsight => ins !== undefined)`** — i.e. missing keys drop out; there is no separate suppress flag.

**Code references:**

```80:84:vnext/projection/rule-layer/assemble-sections.ts
function aspectsForInsightLibraryLookup(options: ProjectionOptions): readonly SnapshotAspect[] {
  const syn = options.pairInteractionAspects;
  if (syn != null && syn.length > 0) return syn;
  return options.snapshotAspects ?? [];
}
```

```710:731:vnext/projection/rule-layer/assemble-sections.ts
      const rawAspects: readonly SnapshotAspect[] = aspectsForInsightLibraryLookup(options);
      const aspectInsights: AspectInsight[] = rawAspects
        .slice(0, 3)
        .map((a) => getAspectInsight(buildAspectKey(a.bodyA, a.bodyB, a.type)))
        .filter((ins): ins is AspectInsight => ins !== undefined);
      if (aspectInsights.length > 0) {
        // ... build mepAspectLibraryText, then prepend via mergeTaggedSectionBodiesVertical
```

```273:295:vnext/projection/rule-layer/assemble-sections.ts
function appendSectionGroupTagged(
  ...
): void {
  if (!block) return;
  if (provenance === 'claim_body') {
    const fresh = block.claimIds.filter((id) => !usedWithinGroup.has(id));
    if (fresh.length === 0 && block.claimIds.length > 0) return;
    // ...
```

### 1.2 Fallback when `getAspectInsight(key)` returns no entry

**Lookup:** `getAspectInsight` is a plain record lookup; `undefined` if the key is absent.

```113:115:vnext/projection/insight-library/insight-library-index.ts
export function getAspectInsight(key: string): AspectInsight | undefined {
  return ASPECT_INSIGHTS[key];
}
```

**Assembler behavior for the MEP insight slice:**

1. **No substitute key** and **no anchor-natal substitution** for the three synastry rows. Missing hits are **dropped** by `.filter(... !== undefined)`.
2. If **no** insights remain, `mepAspectLibraryText` is never set; the signatures section keeps template + MEP claim content only (no library prepend).
3. **Broader surface fallback** (synastry list empty / omitted): `aspectsForInsightLibraryLookup` switches to **`options.snapshotAspects`** (anchor natal aspects). Documented in-file at `aspectsForInsightLibraryLookup` (synastry vs anchor). Options wiring: `insightProjectionOptionsFromCanonical` omits `pairInteractionAspects` when synastry is empty so the assembler uses anchor aspects only.

```22:38:vnext/projection/insight-projection-from-canonical.ts
  const syn = canonicalReport.pair_interaction_aspects;
  const multi = canonicalReport.participants.length >= 2;
  // ...
  if (multi && syn != null && syn.length > 0) {
    const synastry_context =
      canonicalReport.participants.length > 2 ? 'group_aggregate' : 'pair_comparison';
    return {
      snapshotAspects,
      relationalWeatherThemes,
      pairInteractionAspects: syn,
      synastry_context,
    };
  }

  return { snapshotAspects, relationalWeatherThemes };
```

**Other library lookups in the same module:** `getStructuralInsight` / `getRelationalInsight` — optional chaining or explicit checks in `assemble-sections.ts` (e.g. feed signal, relational_field, relational_weather_v1); pattern is “if defined, append; else skip or keep template.”

**Padding / min-sentences fallbacks** (`nextFallbackSentence`, `expandSentencesToMin`, `PAD_SENTENCES`) apply to **claim/template density**, not to replacing missing aspect-library rows.

### 1.3 Policy layer interaction (`relational-reading-enforcement` / `reading-presentation-filter`)

**Where they live:** `apps/web/src/lib/reading-presentation-filter.ts`, `apps/web/src/lib/relational-reading-enforcement.ts`, used from `apps/web/src/lib/community-feed-reading-layout.ts`.

**When they run:** **After** projection artifacts are assembled — `finalizeRelationalReadingSurfaces` maps expanded reading **slots** from section JSON, then applies `applyReadingPresentationPolicies` per sentence (forbidden substrings, structural meta rules) and **near-duplicate** suppression (Jaccard ≥ `0.92`) across narrative slots, with opening-phrase caps. This is **not** inside `vnext`’s `applyUnifiedProjection` chain.

**Interaction with a hypothetical kill-list + assembler fallback:**

- **vnext-only consumers** (e.g. scripts using `projectTextFromSemanticCore`): see assembler output **without** `finalizeRelationalReadingSurfaces` unless the host app invokes it.
- **Web expanded reading:** `signatures` + `significance` text are joined into the **support** slot (`SUPPORT_IDS` in `community-feed-reading-layout.ts`). Library prose merged into `signatures` is part of that string and **is** subject to `applyReadingPresentationPolicies` and duplicate-sentence logic in `enforceNarrativeOwnershipPrefixAndNearDup`.
- **Compounding toward emptiness:** If a kill-list path injected short fallback copy that contained forbidden phrases from `SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN` (e.g. substrings like `this read`, `expanded pass`, `mechanism layer`, `relational weather`), `applyReadingPresentationPolicies` could **strip entire sentences**. Combined with aggressive dedupe / near-dup removal, a slot could shrink substantially or go empty if no repair path runs (relational enforcement does not regenerate dropped content — see header comment in `relational-reading-enforcement.ts`: deterministic, post-assembly, no substitution of dropped content).
- **Paragraph-level dedupe before sentence policies:** `dedupeParagraphsAcrossExpandedSlots` removes **identical** paragraphs (normalized) as slots are processed in `DEDUPE_SLOT_ORDER`; a fallback that repeated the same paragraph as another slot could be removed.

**Code references:**

```1:6:apps/web/src/lib/relational-reading-enforcement.ts
/**
 * Unified relational reading enforcement — single entry point for collapsed feed + expanded artifacts.
 * Deterministic, post-assembly only; no generation or substitution of dropped content.
 */
```

```190:198:apps/web/src/lib/relational-reading-enforcement.ts
  const narrativeIn = {
    summary: applyPoliciesToSlotBody(slots.summary || '', 'narrative'),
    support: applyPoliciesToSlotBody(slots.support || '', 'narrative'),
    // ...
  };

  const narrativeOut = enforceNarrativeOwnershipPrefixAndNearDup(narrativeIn);
```

```7:44:apps/web/src/lib/reading-presentation-filter.ts
/** Substrings (lowercase scan) forbidden inside a sentence. */
export const SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN: readonly string[] = [
  // User-requested scaffolding + established product suppressions
  'the sections stay',
  // ...
  'this read',
  // ...
  'mechanism layer',
  // ...
];
```

**Post-projection inside vnext (separate from web policy):** `applyUnifiedProjection` runs `collapseRepetitionPhase0` after tone pass — sentence-level repetition collapse with validation gates (`repetition-collapse-phase0.ts`). That can remove duplicate **sentences** that fall into removable classes; it is another layer that could interact with repeated fallback or repeated library sentences.

### 1.4 Configuration patterns for lists (for kill-list convention alignment)

| Pattern | Example | Location / notes |
|---------|---------|-------------------|
| **TypeScript `const` arrays / objects** | `SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN`, `SANDBOX_STRIP_SECTION_IDS`, `SYNTH_WRAPPER_*`, `PAD_SENTENCES` | `apps/web/src/lib/reading-presentation-filter.ts`, `assemble-sections.ts`, `assemble-section-tagged.ts` / `phase2-sentence-load.ts` |
| **Canonical body sets** | `CORE_BODIES`, `ADDITIONAL_BODIES`, `SUPPORTED_BODIES` | `vnext/canonical-bodies.ts` — single source for chart / synastry body membership |
| **Versioned JSON literals (projection)** | `feed-fallbacks-v1.json`, `feed-explanation-shells-v1.json`, `aspect-behavior-v1.json`, etc. | `vnext/projection/literals/*.json` — imported where needed (e.g. `map-insight-unit-v1.ts` uses `feed-fallbacks-v1.json`) |
| **Merged static record for aspect library** | `ASPECT_INSIGHTS` object | `insight-library-index.ts` merges split TS modules; **not** JSON-driven |
| **Insight library key derivation** | `buildAspectKey` + `PLANET_ORDER` | `insight-library-index.ts` — code constant ordering |

**Prevailing convention for “configurable” phrase/body lists:** **TS const** for engine-adjacent rules; **versioned JSON** under `vnext/projection/literals/` for feed / surfacing / template buckets; **canonical-bodies** for astrology body enumerations.

### 1.5 Test surface for suppression / closest analogs

- **No** dedicated tests were found that assert aspect-library kill-list, `getAspectInsight` miss paths in `assemble-sections`, or web `finalizeRelationalReadingSurfaces` policies (grep over `*.test.ts` under `apps/web/src/lib` for these modules returned no matches).
- **`npm run test:unified-projection`** (see root `package.json`) runs a **chain** including: `test-unified-projection.js`, `test-repetition-collapse-phase0.js`, `test-phase5-expression-filters.js`, `test-composition-phase4.js`, phase 2/3 scripts, etc. — closest **vnext** analog for **post-assembly** stripping / collapse and expression filters.
- **`vnext/synastry/synastry-compute.test.ts`** covers **group_matrix cap 32** and ranking — upstream of the assembler but relevant when synastry lists contain duplicate `buildAspectKey` outputs.

---

## Audit Area 2 — Duplicate `buildAspectKey` and assembler behavior

### 2.1 Code path: no deduplication by library key before render

**Order of operations:**

1. `pairInteractionAspects` (or anchor `snapshotAspects`) is already whatever the pipeline put in options — for group matrix, the list is **ranked and capped at 32** inside `computeSynastryAspects` (`vnext/synastry/synastry-compute.ts`, `SYNASTRY_GROUP_CAP = 32`, `hits.sort` then `hits.slice(0, SYNASTRY_GROUP_CAP)`).
2. Assembler: `rawAspects = aspectsForInsightLibraryLookup(options)` then **`rawAspects.slice(0, 3)`** — first three **rows**, not three **distinct** keys.
3. Each row → `buildAspectKey(bodyA, bodyB, type)` → `getAspectInsight` → **`undefined` filtered out**.

There is **no** `Map`/`Set` dedupe by key, no “keep highest-ranked distinct key” pass, and no chart-pair attribution in the key (per S3 audit premise — `buildAspectKey` normalizes body order only).

**If the same key appears k times in the first three rows and the library has an entry:** `aspectInsights` contains **k** separate lookups (same strings), and `mepAspectLibraryText` joins them with **`'\n\n'`** → **k copies** of the same library block in projection output (behavior **(a)** for **covered** keys).

**If the same key appears but the library has no entry:** each lookup is `undefined` → all drop → **no** library block for those rows (behavior distinct from (a)–(c); call it **filter-miss collapse**).

### 2.2 Interaction with library **coverage gaps** (empirical clarification)

The S3 Mode 3 fixture JSON (`docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json`) records `aspectLibraryKeysFirst3` using the same `buildAspectKey` as the assembler (`vnext/scripts/synastry-s3-mode3-pre-post.ts`, `firstNAspectKeys`).

Several duplicated keys in fixtures **do not exist** in `ASPECT_INSIGHTS` (merged aspect insight table). Examples verified by repository search:

- **`SUN_SUN_OPPOSITION`** — no entry in `vnext/projection/insight-library/*.ts` (Sun–Sun personal aspects are not in the documented personal batch; oppositions present for Sun–Moon, Sun–Venus, Sun–Mars, etc., not Sun–Sun).
- **`SUN_MERCURY_OPPOSITION`** / **`MOON_MERCURY_SEXTILE`** — no `MERCURY` pair keys in aspect insight modules (only `MERCURY` in `PLANET_ORDER` inside `insight-library-index.ts`).

Therefore fixture rows that show repeated keys often coincide with **lookup misses**, not with triple-rendered prose.

### 2.3 Fixture verification (Mode 3 JSON vs behaviors (a)–(d))

| Fixture | `aspectLibraryKeysFirst3` (post Mode 3) | First part of `signaturesText` | Consistent with |
|---------|----------------------------------------|--------------------------------|-----------------|
| `mode3_group_six_charts` | `SUN_SUN_OPPOSITION` ×3 | Starts with template framing (“Here, you see a steadier framing…”) — **no** long Sun–Sun opposition library block | Keys **missing** from library → all three filtered → **no** MEP library prepend (not (a) triple duplicate). |
| `mode3_group_four_charts` | `SUN_SUN_OPPOSITION`, `SUN_SUN_OPPOSITION`, `SUN_MOON_CONJUNCTION` | Starts with **`SUN_MOON_CONJUNCTION`** long library prose | First two keys miss; third **hits** → **single** library block prepended (not triple Sun–Sun). |
| `mode3_group_three_charts` | `SUN_MERCURY_OPPOSITION` ×2, `MOON_MERCURY_SEXTILE` | Starts with template framing (no personal-aspect library opener) | All three keys **miss** in current library → **no** library prepend. |
| Mode 1 comparison `fixture_2_tight_personal_cross` (same JSON) | `SUN_SUN_OPPOSITION` ×2, `SUN_MOON_CONJUNCTION` | Starts with **`SUN_MOON_CONJUNCTION`** library | Same pattern: misses filtered, one hit remains. |

**Conclusion:** Shipping behavior for “duplicate keys in first three” is **not** dedupe-by-key **nor** pick-highest-ranked-distinct; it is **(1)** optional **triple (or double) render** only when **`getAspectInsight` returns a defined object for each row**, plus **(2)** pervasive **filter-miss** when keys are absent from `ASPECT_INSIGHTS`. Fixture text matches **(2)** for Sun–Sun / Sun–Mercury cases, not naive triple duplication.

### 2.4 Cap 32 vs distinct keys vs slice of 3

- **Cap 32:** Applied in **`computeSynastryAspects`** after global sort of all directed pair hits — **no** deduplication by `buildAspectKey` before the cap. The top 32 rows can include **many rows that map to the same library key** or to **missing** keys.
- **Slice of 3:** Applied in **`assemble-sections.ts`** on the **post-cap ordered list** — still **no** key deduplication.
- **Effective “distinct library keys” in UI copy:** Can be **0–3** depending on lookup success; can be **1** even when three synastry rows rank highly, if the first two keys miss the library.

### 2.5 “Max three slices” boundary

- **Constant:** `.slice(0, 3)` on `rawAspects` in `assemblePhaseDSections` when attaching MEP aspect library text to the **signatures** (or first spine) section.
- **Relative to deduplication:** **Independent** — there is no assembler dedupe step before or after the slice.
- **Merge order:** `mergeTaggedSectionBodiesVertical(libTagged, tagged)` puts **library paragraphs first**, then enriched template + MEP tagged body (`tagged-text.ts`).

### 2.6 Concrete examples (input → keys → rendered)

Examples are taken from `docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json` (script output, not hand-edited).

**A) Six charts — triple `SUN_SUN_OPPOSITION`, all miss library**

- **Synastry:** `synastryMatrixHitCount: 32`; first three aspect keys on matrix: `SUN_SUN_OPPOSITION` ×3 (fixture field `synastryMatrixFirst3Keys` / `aspectLibraryKeysFirst3`).
- **Keys after `buildAspectKey`:** Same strings (already canonical keys).
- **Rendered `signaturesText` (opening):** Template / MEP-style paragraphs only (e.g. “Here, you see a steadier framing with mixed steady and active layers today…”) — **no** insight-library Sun–Sun opposition paragraph.

**B) Four charts — two misses + one hit**

- **Keys:** `SUN_SUN_OPPOSITION`, `SUN_SUN_OPPOSITION`, `SUN_MOON_CONJUNCTION`.
- **Rendered `signaturesText` (opening):** Full **`SUN_MOON_CONJUNCTION`** insight-library copy (“The Sun, the seat of conscious will… sits fused with the Moon…”), then template paragraphs — consistent with only the third row contributing library text.

**C) Mode 1 pair comparison `fixture_2` — same pattern as (B)**

- **Keys:** `SUN_SUN_OPPOSITION` ×2, `SUN_MOON_CONJUNCTION`.
- **Rendered:** Opens with **`SUN_MOON_CONJUNCTION`** library block; not duplicated Sun–Sun text.

*(The JSON does not echo the raw `SnapshotAspect[]` rows in the doc artifact; the authoritative hit list is whatever `computeSynastryAspects` / canonical serialization produced when the fixture was generated. Keys above are the fixture’s recorded `aspectLibraryKeysFirst3` / matrix first-three keys.)*

---

## Structural surprises for Stage A drafting

1. **Library coverage vs synastry geometry:** Synastry can surface **many** body-pair/type combinations that **`ASPECT_INSIGHTS` does not cover**. The assembler **silently omits** those rows from the MEP library slice. A kill-list spec must distinguish **suppressed-by-policy** keys from **never-authored** keys (today both become `undefined` after lookup).
2. **Duplicate keys + missing entries** mimic “deduplication” in fixtures but the mechanism is **`filter`, not key logic**.
3. **Two post-text pipelines:** (A) **vnext** `collapseRepetitionPhase0` + validators; (B) **web** `finalizeRelationalReadingSurfaces` + forbidden phrases + Jaccard. Stage A wording should name which consumer path is in scope.
4. **`aspectLibraryKeysFirst3` in docs** is derived from **`canonical.pair_interaction_aspects`** order (`synastry-s3-mode3-pre-post.ts`), which should match `insightProjectionOptionsFromCanonical`’s `pairInteractionAspects` — same slice(0,3) semantics as the assembler **when** the canonical array matches options (it does in the fixture script path).

---

## Items likely more complex than a naive “kill-list + fallback” plan

1. **Aligning kill-list with existing miss behavior:** Today “missing” and “would be kill-listed” both result in `undefined` after `getAspectInsight` unless the kill-list is implemented **inside** or **after** lookup with explicit telemetry / alternate content.
2. **Policy compounding:** Fallback copy must be audited against `SYSTEM_LANGUAGE_SENTENCE_FORBIDDEN` and structural meta rules if expanded reading enforcement will run.
3. **Triple-render for covered duplicate keys:** If future library expansion adds entries for currently-missing hot keys (e.g. Sun–Sun), **triple identical blocks** could appear in **vnext** `signatures` until dedupe is specified; **web** expanded layout may partially collapse identical paragraphs across slots.
4. **Cap-32 efficiency for “distinct interpretability”:** The cap constrains **rows**, not **distinct library keys** or **pair-attributed** keys — so ranking pressure and duplicate-key collision are coupled problems.

---

## File / function quick index

| Topic | Files |
|-------|--------|
| MEP aspect library attach | `vnext/projection/rule-layer/assemble-sections.ts` (`assemblePhaseDSections`) |
| Synastry source + anchor fallback | `assemble-sections.ts` (`aspectsForInsightLibraryLookup`); `vnext/projection/insight-projection-from-canonical.ts` |
| Lookup + key build | `vnext/projection/insight-library/insight-library-index.ts` |
| Group matrix cap / sort | `vnext/synastry/synastry-compute.ts` (`computeSynastryAspects`) |
| Projection order | `vnext/projection/rule-layer/apply-unified-projection.ts` |
| Tagged merge | `vnext/projection/tagged-text.ts` (`mergeTaggedSectionBodiesVertical`) |
| Web policy + finalize | `apps/web/src/lib/relational-reading-enforcement.ts`, `reading-presentation-filter.ts`, `community-feed-reading-layout.ts` |
| S3 fixture generator | `vnext/scripts/synastry-s3-mode3-pre-post.ts` |
| Fixture artifact cited | `docs/SYNASTRY-S3-MODE3-FIXTURE-OUTPUT.json` |

---

*End of audit — ready for S5 Stage A implementation prompt drafting.*
