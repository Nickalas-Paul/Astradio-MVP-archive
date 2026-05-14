# PHASE 1 AUDIT REPORT
## Legacy Template Removal - Discovery Phase

**Date:** 2026-05-10  
**Duration:** Audit pass based on repository reads/searches  
**Status:** COMPLETE  
**Scope:** Documentation only. No projection behavior changes.

---

## EXECUTIVE SUMMARY

Total report/projection sections found: 27 logical section IDs/families.

- Category A (legacy/no insight-library lookup): 13 sections
- Category B (mixed legacy + insight-library or library fallback): 8 sections
- Category C (library-owned or effectively library-only): 6 sections

Template removal complexity: **HIGH**.

Estimated Phase 2 effort: **3-5 days** for output-path suppression plus schema/API mapping updates.

Estimated Phase 3 effort: **4-7 days** for mixed-section surgery, library-only aspect ownership, and dead-code excision.

Key correction to the master plan: several sections previously described as pure template are actually mixed:

- `significance` can use `getStructuralInsight()` through `buildSupplementalPanel()`.
- `relational_field` can be overwritten by `getRelationalInsight()`.
- `relational_weather_v1` can be overwritten by `getRelationalInsight()`.
- `audio_staging` uses `getAudioInsight()` but still has legacy fallback clauses.

The safest path is to first update output ownership and downstream consumers, then remove dead template paths.

---

## DELIVERABLE 1: SECTION INVENTORY

| Section ID | Title | Surfaces | File | Function | Start Line | End Line | Template% | Library% | Category | Risk |
|---|---|---|---|---|---:|---:|---:|---:|---|---|
| `feed_signal` | Signal | Feed card | `vnext/projection/rule-layer/assemble-sections.ts` | `buildFeedSections` | 532 | 589 | 50% | 50% | B | MEDIUM |
| `feed_context` | Scope | Feed card | `vnext/projection/rule-layer/assemble-sections.ts` | `buildFeedSections` | 532 | 589 | 50% | 50% | B | MEDIUM |
| `core_identity` | Core Identity Architecture | Profile, overlay, compat activation | `vnext/projection/rule-layer/assemble-sections.ts` | `assembleProfileIdentityPlacementSections`; `assembleOverlayActivationSections`; `assembleCompatActivationSections` | 607 | 1133 | 10% | 90% | C | LOW |
| `personal_expression` | Personal Expression | Profile, overlay, compat activation | `vnext/projection/rule-layer/assemble-sections.ts` | `assembleProfileIdentityPlacementSections`; `assembleOverlayActivationSections`; `assembleCompatActivationSections` | 607 | 1133 | 10% | 90% | C | LOW |
| `growth_expansion` | Growth and Expansion | Profile, overlay, compat activation | `vnext/projection/rule-layer/assemble-sections.ts` | `assembleProfileIdentityPlacementSections`; `assembleOverlayActivationSections`; `assembleCompatActivationSections` | 607 | 1133 | 10% | 90% | C | LOW |
| `evolutionary_currents` | Evolutionary Currents | Profile, overlay, compat activation | `vnext/projection/rule-layer/assemble-sections.ts` | `assembleProfileIdentityPlacementSections`; `assembleOverlayActivationSections`; `assembleCompatActivationSections` | 607 | 1133 | 10% | 90% | C | LOW |
| `no_activations` | Current Transit Window / Synastry Overview | Overlay fallback, compat fallback | `vnext/projection/rule-layer/assemble-sections.ts` | `buildMinimalOverlaySections`; `buildMinimalCompatSynastryActivationSections` | 757 | 911 | 100% | 0% | A | LOW |
| `group_key_interactions_v1` | Key interactions | Group, sandbox group | `vnext/projection/rule-layer/assemble-sections.ts` | `assembleGroupKeyInteractionsV1` | 920 | 997 | 5% | 95% | C | LOW |
| `synthesis_a` | Synastry synthesis / Synthesis | Compat expanded/extended, group/profile/sandbox expanded paths | `vnext/projection/rule-layer/assemble-sections.ts` | `buildSynastryLibrarySynthesisSectionBodies`; expansion loop | 1142 | 1708 | 60% | 40% | B | HIGH |
| `synthesis_b` | Extended synastry / Extended synthesis | Compat/group/profile extended paths | `vnext/projection/rule-layer/assemble-sections.ts` | `buildSynastryLibrarySynthesisSectionBodies`; expansion loop | 1142 | 1779 | 60% | 40% | B | HIGH |
| `signatures` | Astrological Signatures | Sandbox, compat, group, campaign; profile is renamed to `aspects` | `vnext/projection/rule-layer/template-lines.ts`; `assemble-sections.ts` | `lineForTemplate`; `assemblePhaseDSections` | 127 | 1483 | 60% | 40% | B | HIGH |
| `aspects` | Planetary Relationships | Profile only after rename from `signatures` | `vnext/projection/rule-layer/assemble-sections.ts` | `assemblePhaseDSections` | 1299 | 1553 | 60% | 40% | B | HIGH |
| `significance` | Personal Significance | Profile, sandbox, compat, group, campaign alias `Why it matters` | `vnext/projection/rule-layer/template-lines.ts`; `assemble-sections.ts`; `claim-synthesize.ts` | `lineForTemplate`; `assemblePhaseDSections`; `buildSupplementalPanel` | 144 | 1411 | 70% | 30% | B | HIGH |
| `musical` | Musical Identity and Flow | Profile, sandbox, compat, group, campaign alias `Listen metaphor` | `vnext/projection/rule-layer/template-lines.ts`; `assemble-sections.ts` | `lineForTemplate`; `assemblePhaseDSections` musical branch | 152 | 1393 | 100% | 0% | A | MEDIUM |
| `relational_field` | Composite field / relational field | Compat, group | `vnext/projection/rule-layer/template-lines.ts`; `assemble-sections.ts` | `lineForTemplate`; `applyAggregateSurfaceIdentityOverrides`; relational override branch | 201 | 1527 | 60% | 40% | B | HIGH |
| `relational_weather_v1` | Relational field (structural) | Compat/group with relational weather | `vnext/projection/rule-layer/template-lines.ts`; `assemble-sections.ts` | `lineForTemplate`; relational weather override branch | 206 | 1546 | 50% | 50% | B | MEDIUM |
| `connection_structure` | Connection framing | Compat pair | `vnext/projection/rule-layer/connection-preface.ts` | `applyConnectionPreface` | 131 | 153 | 100% | 0% | A | MEDIUM |
| `ensemble_framing` | Ensemble field | Group, non-sandbox unless suppressed | `vnext/projection/rule-layer/connection-preface.ts` | `applyConnectionPreface` | 155 | 164 | 100% | 0% | A | LOW |
| `temporal_integration` | Temporal integration | Daily expanded/extended | `vnext/projection/rule-layer/assemble-sections.ts`; `template-lines.ts` | expansion loop; `temporalIntegrationLine` | 86 | 1805 | 100% | 0% | A | LOW |
| `trait_bridge` | Trait bridge | Profile expanded/extended | `vnext/projection/rule-layer/assemble-sections.ts` | expansion loop | 1807 | 1835 | 100% | 0% | A | LOW |
| `interaction_map` | Interaction map | Compat expanded/extended | `vnext/projection/rule-layer/assemble-sections.ts` | expansion loop | 1836 | 1870 | 100% | 0% | A | MEDIUM |
| `field_distribution` | Field distribution | Group expanded/extended | `vnext/projection/rule-layer/assemble-sections.ts` | expansion loop | 1871 | 1898 | 100% | 0% | A | LOW |
| `pressure_response` | Pressure -> response | Campaign expanded/extended | `vnext/projection/rule-layer/assemble-sections.ts` | expansion loop | 1900 | 1924 | 100% | 0% | A | LOW |
| `layering` | Layering (natal / sky) | Overlay expansion key, though overlay early return currently bypasses main expansion path | `vnext/projection/rule-layer/assemble-sections.ts` | expansion loop | 1926 | 1953 | 100% | 0% | A | LOW |
| `delta_emphasis` | Sandbox note | Sandbox expanded/extended | `vnext/projection/rule-layer/assemble-sections.ts` | expansion loop | 1955 | 1983 | 100% | 0% | A | LOW |
| `contradiction_map` | Contrast map | Profile extended | `vnext/projection/rule-layer/assemble-sections.ts` | post-expansion block | 1986 | 2015 | 100% | 0% | A | LOW |
| `subcluster` | Subcluster | Group extended | `vnext/projection/rule-layer/assemble-sections.ts` | post-expansion block | 2017 | 2043 | 100% | 0% | A | LOW |
| `depth_panel_N` | Pattern note N | Auto-fill on non-sandbox surfaces | `vnext/projection/rule-layer/assemble-sections.ts`; `claim-synthesize.ts` | fill loop; `buildSupplementalPanel` | 2046 | 2093 | 70% | 30% | B | MEDIUM |
| `audio_staging` | How this sounds (listen metaphor) | Most full surfaces | `vnext/projection/rule-layer/audio-lexicon.ts`; `assemble-sections.ts` | `buildAudioStagingBlock`; audio append block | 325 | 2152 | 20% | 80% | C | MEDIUM |
| `audio_thread` | Audio thread | Extended non-sandbox | `vnext/projection/rule-layer/assemble-sections.ts` | audio thread insertion | 2154 | 2174 | 100% | 0% | A | LOW |

Notes:

- Percentages are implementation estimates, not runtime token counts.
- `aspects` is not separately authored; profile `signatures` is renamed at `assemble-sections.ts:1550-1553`.
- `lineForTemplate()` creates initial template bodies for template IDs; `assemblePhaseDSections()` then enriches, overrides, renames, and reorders them.

---

## DELIVERABLE 2: TEMPLATE SOURCE MAP

### Section: `musical` - Musical Identity and Flow

**Template Source**

- File: `vnext/projection/rule-layer/template-lines.ts`
- Function: `lineForTemplate()`, case `SECTION_MUSICAL`
- Lines: 152-156
- Template behavior: emits title and empty text. Actual prose comes later from claim-bundle listen rendering, not audio library.

```ts
case 'SECTION_MUSICAL':
  return {
    title: ctx.suppressAstrologyTitles ? 'Listen metaphor' : 'Musical Identity and Flow',
    text: '',
  };
```

**Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`
- Lines: 1370-1393
- Calls: `renderMechanismArcBlock(... register: 'listen')`
- Category: A, because no insight-library lookup is used in this section path.

### Section: `connection_structure` - Connection framing

**Template Source**

- File: `vnext/projection/rule-layer/connection-preface.ts`
- Bundles: `FRIENDS_BUNDLES`, `LOVERS_BUNDLES`, `NEUTRAL_BUNDLES`
- Lines: 13-90

**Assembly**

- File: `vnext/projection/rule-layer/connection-preface.ts`
- Function: `applyConnectionPreface()`
- Lines: 131-153
- Emits `connection_structure` when `surface === 'compat_pair' && connectionMode && connectionMode !== 'group'`.

### Section: `ensemble_framing` - Ensemble field

**Template Source**

- File: `vnext/projection/rule-layer/connection-preface.ts`
- Bundle: `ENSEMBLE_BUNDLES`
- Lines: 92-128

**Assembly**

- File: `vnext/projection/rule-layer/connection-preface.ts`
- Function: `applyConnectionPreface()`
- Lines: 155-164
- Emits `ensemble_framing` when `surface === 'group' && participantCount > 2 && !suppressEnsembleFraming`.

### Section: `audio_thread` - Audio thread

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`
- Lines: 2154-2174
- Fixed string: `Listen detail lives in “How this sounds (listen metaphor)” below; it mirrors the words above without repeating every clause.`
- Category: A.

### Section: `no_activations`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Functions:
  - `buildMinimalOverlaySections()`, lines 757-768
  - `buildMinimalCompatSynastryActivationSections()`, lines 900-911
- Category: A fallback copy. Deletion risk is low only if callers tolerate zero activation sections.

### Section: `temporal_integration`

**Template Source**

- File: `vnext/projection/rule-layer/template-lines.ts`
- Function: `temporalIntegrationLine()`
- Lines: 86-103
- Example legacy string: `Both steady and quick layers count; name which timescale you mean before you lock one story.`

**Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`, expansion loop
- Lines: 1781-1805

### Section: `trait_bridge`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`, expansion loop
- Lines: 1807-1835
- Fixed variants beginning `Trait bridge: ...`

### Section: `interaction_map`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`, expansion loop
- Lines: 1836-1870
- Fixed variants beginning `Interaction map: ...`
- Category: A, although it is semantically relational.

### Section: `field_distribution`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`, expansion loop
- Lines: 1871-1898
- Fixed variants beginning `Field distribution: ...`

### Section: `pressure_response`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`, expansion loop
- Lines: 1900-1924
- Uses `buildCampaignPressureResponseParagraph()`, not insight-library.

### Section: `layering`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`, expansion loop
- Lines: 1926-1953
- Fixed variants beginning `Layering: ...`

### Section: `delta_emphasis`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`, expansion loop
- Lines: 1955-1983
- Fixed variants beginning `Sandbox delta: ...`

### Section: `contradiction_map`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`
- Lines: 1986-2015
- Fixed contrast-handling copy plus existing tension block.

### Section: `subcluster`

**Template Source / Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `assemblePhaseDSections()`
- Lines: 2017-2043
- Fixed variants beginning `Subcluster note: ...`

### Template Spine: `SECTION_SIGNATURES`, `SECTION_SIGNIFICANCE`, `SECTION_MUSICAL`

**Template Source**

- File: `vnext/projection/rule-layer/template-lines.ts`
- Function: `lineForTemplate()`
- Lines:
  - `SECTION_SIGNATURES`: 127-143
  - `SECTION_SIGNIFICANCE`: 144-151
  - `SECTION_MUSICAL`: 152-156

**Assembly**

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Function: `buildEmphasisRawSections()`
- Lines: 500-518
- Key call: `lineForTemplate(tid, core, ..., templateCtx)` at line 508.

These are not all pure Category A at runtime because `assemblePhaseDSections()` enriches/overwrites them later.

---

## DELIVERABLE 3: SURGERY PLANS

### Mixed Section: `signatures` / profile `aspects`

**Current Implementation**

- Template source: `vnext/projection/rule-layer/template-lines.ts`, `lineForTemplate()`, lines 127-143
- Runtime assembly: `vnext/projection/rule-layer/assemble-sections.ts`, `assemblePhaseDSections()`, lines 1299-1483 and profile rename at 1550-1553

**Line-by-Line Breakdown**

- Lines 1299-1314: Determine whether current raw section is MEP/signatures slot or supplemental slot. Preserve only if a library-only replacement still needs slot routing; otherwise delete.
- Lines 1315-1323: Append tier opener, claim MEP text, and tension block. Delete for library-only aspect section.
- Lines 1324-1331: Append sandbox lab framing. Delete.
- Lines 1332-1340: Extract top 3 `SnapshotAspect` rows from `ProjectionOptions` and lookup `getAspectInsight()`. Preserve, but move to a library-only helper and likely increase/parameterize count.
- Lines 1341-1368: Render aspect library text by surface. Preserve the `getAspectInsight()` and `composeSynastryMepAspectParagraph()` portions; remove feed/overlay branches if not needed in this replacement.
- Lines 1370-1474: Musical/supplemental/claim enrichment branches for other sections. Not part of library aspect replacement.
- Lines 1478-1483: Merge library aspect text above tagged template/claim text. Modify so final section consists only of library paragraphs.
- Lines 1550-1553: Profile-specific rename to `aspects` / `Planetary Relationships`. Preserve conceptually; make ID/title explicit in new function.

**Library Rendering Code to Preserve**

```ts
const rawAspects: readonly SnapshotAspect[] = aspectsForInsightLibraryLookup(options);
const aspectInsights: AspectInsight[] = rawAspects
  .slice(0, 3)
  .map((a) => {
    const key = buildAspectKey(a.bodyA, a.bodyB, a.type);
    if (isAspectLibraryKillListed(key)) return undefined;
    return getAspectInsight(key);
  })
  .filter((ins): ins is AspectInsight => ins !== undefined);
```

```ts
if (effSurface === 'compat_pair' || effSurface === 'group') {
  return composeSynastryMepAspectParagraph(
    ins,
    context === 'romantic' ? 'romantic' : 'friendship'
  );
}
return [ins.core, ins.behavioral].filter(Boolean).join(' ');
```

**New Library-Only Function Design**

```ts
function assembleLibraryAspectSection(params: {
  options: ProjectionOptions;
  surface: ProjectionSurface;
  connectionMode?: ConnectionMode;
  maxAspects: number;
}): ProjectedExplanationSection[] {
  if (params.surface === 'group') return []; // group_key_interactions_v1 owns group synastry

  const rawAspects = aspectsForInsightLibraryLookup(params.options);
  const paragraphs = rawAspects
    .map((a) => {
      const key = buildAspectKey(a.bodyA, a.bodyB, a.type);
      if (isAspectLibraryKillListed(key)) return null;
      const insight = getAspectInsight(key);
      if (!insight) return null;
      if (params.surface === 'compat_pair') {
        const romantic = params.connectionMode === 'lovers' || params.connectionMode === 'romantic';
        return composeSynastryMepAspectParagraph(insight, romantic ? 'romantic' : 'friendship');
      }
      return [insight.core, insight.behavioral].filter(Boolean).join(' ');
    })
    .filter(Boolean)
    .slice(0, params.maxAspects);

  if (paragraphs.length === 0) return [];
  return [{ id: 'aspects', title: 'Planetary Relationships', text: paragraphs.join('\n\n---\n\n') }];
}
```

**Duplication Risk**

- Current compat guard exists at lines 1343-1346.
- There is no group guard. Groups can render synastry once in `group_key_interactions_v1` and again inside `signatures`.
- Recommended Phase 2 action: group surface should skip the library aspect append entirely because `group_key_interactions_v1` is the group synastry owner.

### Mixed Section: `significance`

**Current Implementation**

- Template source: `template-lines.ts:144-151`
- Assembly/enrichment: `assemble-sections.ts:1311-1411`
- Structural insight fallback: `claim-synthesize.ts:748-829`, especially `getStructuralInsight()` at 786

**Breakdown**

- `SECTION_SIGNIFICANCE` text is generic element/tonal prose. Delete.
- `buildSupplementalPanel()` can choose `getStructuralInsight()` and return library-backed structural text. Preserve only if a new library-owned structural section is desired.
- If no `getStructuralInsight()` hit exists, it falls back to claim-expression bundle prose. Delete fallback for the unified-library target.

**Surgery Plan**

1. Do not simply delete `buildSupplementalPanel()` globally; it is also used by depth panels and other sections.
2. Stop emitting `significance` as a public section.
3. If structural insights are still desired, create a separate library-only structural section that returns only when `getStructuralInsight(claim_id)` hits.
4. Update downstream consumers in `compose.ts` that currently read `significance`.

### Mixed Section: `relational_field`

**Current Implementation**

- Template source: `template-lines.ts:201-205` (`SECTION_AGGREGATE_FIELD`, title `Composite field`)
- Aggregate override: `assemble-sections.ts:311-359`
- Relational library override: `assemble-sections.ts:1489-1527`
- Section kind dependency: `composition-phase4.ts:120`

**Breakdown**

- `SECTION_AGGREGATE_FIELD` and `aggregateFieldText()` are template prose. Delete or make unreachable.
- `applyAggregateSurfaceIdentityOverrides()` replaces `relational_field` with generic identity/room framing. Delete.
- `getRelationalInsight('GROUP_RELATIONAL_FIELD_NEUTRAL')` and `getRelationalInsight(classCode)` are library paths. Preserve only if `relational_field` remains as a library-owned relational section.

**Surgery Plan**

1. Decide if `relational_field` remains as a library relational-class section or is removed entirely.
2. If kept, require a `getRelationalInsight()` hit; skip when no class/theme/library row exists.
3. Remove `Composite field` template fallback.
4. Update `compose.ts:922`, `compose.ts:928`, and `compose.ts:936`, which currently treat `relational_field` as a lead section.

### Mixed Section: `relational_weather_v1`

**Current Implementation**

- Template source: `template-lines.ts:206-214`
- Library override: `assemble-sections.ts:1529-1546`

**Breakdown**

- Template line `Between people, the picture highlights: ...` is generic. Delete.
- `getRelationalInsight(primaryTheme)` path is valid library rendering. Preserve.

**Surgery Plan**

1. Emit only when `options.relationalWeatherThemes[0]` exists and `getRelationalInsight()` returns text.
2. Remove template fallback from `lineForTemplate()`.

### Mixed Section: `synthesis_a` / `synthesis_b`

**Current Implementation**

- Library path: `buildSynastryLibrarySynthesisSectionBodies()`, lines 1142-1194
- Library emission for compat V2: lines 1585-1647
- Claim fallback for `synthesis_a`: lines 1648-1708
- Claim fallback for `synthesis_b`: lines 1710-1779

**Breakdown**

- Preserve `buildSynastryLibrarySynthesisSectionBodies()` for compat V2 with seeker context.
- Delete claim fallback paths from `buildDisciplinedSynthesisClaimBodies()`.
- If no library content exists, skip synthesis sections.

**Surgery Plan**

1. Keep compat V2 condition at lines 1589-1592.
2. Remove/skip `buildDisciplinedSynthesisClaimBodies()` fallbacks.
3. Update expansion keys in `surface-schemas.ts` so validation does not expect synthesis sections where no library content exists.

### Mixed Section: `feed_signal` / `feed_context`

**Current Implementation**

- File: `assemble-sections.ts`
- Function: `buildFeedSections()`, lines 532-589
- `feed_signal`: claim text plus optional `getStructuralInsight()` at 554-557
- `feed_context`: fixed `FEED_SCOPE_SENTENCE` plus optional `getRelationalInsight()` at 569-575

**Surgery Plan**

1. If feed cards are in scope for library-only migration, require library hits.
2. For `feed_signal`, prefer `getStructuralInsight(feedSignalClaim)?.feed`; skip generic claim sentence fallback.
3. For `feed_context`, prefer `getRelationalInsight(theme)?.feed`; keep fixed scope sentence only if product wants non-reading meta copy.

### Mixed Section: `depth_panel_N`

**Current Implementation**

- Fill loop: `assemble-sections.ts:2046-2093`
- Uses `buildSupplementalPanel()` from `claim-synthesize.ts:748-829`

**Surgery Plan**

1. Remove automatic filler panels in Phase 2 or reduce `baselineMinSections`.
2. If retained, only emit panels when `getStructuralInsight()` hits.
3. Delete claim-bundle/padding fallbacks.

### Mixed Section: `audio_staging`

**Current Implementation**

- Library/fallback merge: `audio-lexicon.ts:207-293`
- Owner section builder: `audio-lexicon.ts:325-369`
- Append in assembly: `assemble-sections.ts:2096-2152`

**Breakdown**

- `getAudioInsight()` calls at `audio-lexicon.ts:221`, 224, 227, 230, 233 are valid library rendering.
- Legacy fallback clauses are generated at `audio-lexicon.ts:244-248` and returned at 250-277 when library coverage is empty or insufficient.

**Surgery Plan**

1. Keep `audio_staging` as the sole listen/audio section.
2. Remove `musical` and `audio_thread`.
3. After verifying audio library coverage, remove fallback return of `legacyFused`; either skip section or fail tests if coverage is incomplete.

---

## DELIVERABLE 4: CROSS-REFERENCE ANALYSIS

### Summary

Cross-references exist. Sections are **not** fully independent. The biggest consumers are `compose.ts`, `composition-phase4.ts`, tests/scripts, and post-processing passes.

### Production/API Consumers

#### `vnext/api/compose.ts:355-368`

- Reads `signatures` or `sky_summary` for short text.
- Reads `musical` or `music_translation` for bullets/text.
- Exposes `signatures`, `significance`, `musicalParagraph`, `musicalBullets` fields.
- Impact: Removing `signatures`, `significance`, or `musical` without remapping breaks API response shape or leaves empty fields.

#### `vnext/api/compose.ts:922-955`

- Reads `signatures` or `relational_field` into `signaturesText`.
- Reads `significance`.
- Reads `musical`.
- Excludes `signatures` and `relational_field` from `longBody`.
- Builds summaries from `relational_field`, `interaction_map`, `contradiction_map`, `synthesis_b`, `significance`, and `synthesis_a`.
- Impact: Aggregate/community outputs require response remapping before section removal.

#### `vnext/api/compatibility-intent.ts:108`

- Generic `sections.find((s) => s.id === sectionId)` helper.
- Impact depends on caller-provided section IDs.

#### `vnext/compat/matches.ts:97`

- Generic `sections.find((s) => s.id === sectionId)` helper.
- Impact depends on caller-provided section IDs.

### Projection Post-Processing Dependencies

#### `vnext/projection/rule-layer/composition-phase4.ts:637-640`

- Finds `audio_thread`.
- Checks if first section is `connection_structure` or `ensemble_framing`.
- Impact: Removing these sections requires simplifying relocation/start-index logic.

#### `vnext/projection/rule-layer/repetition-collapse-phase0.ts:279`, 395

- Finds `audio_staging`.
- Impact: keep `audio_staging`; safe.

#### `vnext/projection/rule-layer/apply-unified-projection.ts:78-82`, 105-109, 138-142

- Mutates first and last sections for metadata.
- Impact: if section count becomes zero for a surface, this must be guarded.

### Script/Test Consumers

Multiple scripts assert or inspect legacy IDs:

- `vnext/scripts/test-phase5-expression-filters.ts:577`, 589, 756, 761, 796
- `vnext/scripts/explain-spec-shape-test.ts:110`, 133
- `vnext/scripts/phase8-compose-signatures-inspection.ts:103-129`
- `vnext/scripts/synastry-fixture-pre-post.ts:132-135`
- `vnext/scripts/synastry-s3-mode3-pre-post.ts:187-191`
- `vnext/scripts/test-composition-phase4.ts:99-107`
- `vnext/scripts/smoke-text-quality-group-live.mjs:79-87`

Impact: tests/smokes will need Phase 2 updates to assert the new section owners.

### Explainer Legacy Renderer

`vnext/explainer/renderers/deterministic.ts:43-134` still has a separate explainer architecture building `signaturesText`, `significanceText`, and `musicalText`.

Impact: If this path is still used by any surface, it must be included in dead-path excision or explicitly declared out-of-scope.

---

## DELIVERABLE 5: SEMANTICCORE.TEXT USAGE

### Total instances found

Projection/runtime usage:

- `assemble-sections.ts:507`
- `tone-pass.ts:261`
- `audio-projection.ts:92`, 97, 98

Semantic construction/validation usage:

- `semantic-authority.ts:328-354`, 495-509
- `validate-semantic-core.ts:34-35`
- `semantic-core.ts:54-58`
- `ontology-codes.ts:115-131`

### Category A: Template Selection (DELETE)

| File | Line | Code | Usage |
|---|---:|---|---|
| `vnext/projection/rule-layer/assemble-sections.ts` | 507 | `for (const tid of core.text.emphasis_order)` | Drives template-section spine through `lineForTemplate()` |
| `vnext/semantic/semantic-authority.ts` | 328-354 | `textEnvelopeForSurface(...)` | Creates template IDs such as `SECTION_SIGNATURES`, `SECTION_SIGNIFICANCE`, `SECTION_MUSICAL` |
| `vnext/semantic/semantic-authority.ts` | 501-504 | Inserts `SECTION_RELATIONAL_WEATHER` before `SECTION_MUSICAL` | Template-order mutation |

### Category B: Tone Metadata (KEEP OR REPLACE)

| File | Line | Code | Usage |
|---|---:|---|---|
| `vnext/projection/rule-layer/tone-pass.ts` | 261 | `const flags = core.text.forbidden_tone_flags` | Forbidden tone substitution, e.g. shadow wording |
| `vnext/projection/audio-projection.ts` | 92 | `core.text.forbidden_tone_flags.includes('TONE_AVOID_SHADOW')` | Audio prompt/profile metadata |
| `vnext/projection/audio-projection.ts` | 97-98 | tone flags for mirror/water language | Audio prompt/profile metadata |

### Category C: Validation / Type Contract (KEEP UNTIL SCHEMA CHANGE)

| File | Line | Code | Usage |
|---|---:|---|---|
| `vnext/semantic/validate-semantic-core.ts` | 34-35 | validates `core.text.section_eligibility` and `core.text.emphasis_order` | SemanticCore schema validation |
| `vnext/semantic/semantic-core.ts` | 54-58 | `TextProjectionEnvelope` definition | Core schema |
| `vnext/semantic/ontology-codes.ts` | 115-131 | `SECTION_TEMPLATE_IDS` | Template ID ontology |

Recommendation: Phase 2 should remove projection dependence on `core.text.emphasis_order`; a later schema migration can remove template IDs from `SemanticCore` after downstream validation is updated.

---

## DELIVERABLE 6: SURFACE BRANCHING

### Main Surface Entry Branches

| File | Lines | Branch | Impact |
|---|---:|---|---|
| `assemble-sections.ts` | 1200-1205 | `feed` returns `buildFeedSections`; `overlay_pair` returns `assembleOverlayActivationSections` | Feed/overlay bypass the legacy three-section spine |
| `assemble-sections.ts` | 1208-1214 | Builds `TemplateContext`; calls `buildEmphasisRawSections` | Main legacy spine for profile/sandbox/compat/group/campaign/daily |
| `assemble-sections.ts` | 403-497 | `filterAndOrderPhase3Sections()` orders profile/sandbox/compat/group | Deleting sections requires order/schema updates |

### Section Ordering Branches

| Surface | Lines | Ordered IDs |
|---|---:|---|
| `profile` | 431-449 | `core_identity`, `personal_expression`, `growth_expansion`, `evolutionary_currents`, `aspects`, `signatures`, `significance`, `trait_bridge`, `synthesis_a`, `synthesis_b`, `musical`, `contradiction_map`, depth panels, `audio_staging`, `audio_thread` |
| `sandbox` | 452-453 | `significance`, `signatures`, `delta_emphasis`, `synthesis_a`, `musical`, depth panels, `audio_staging` |
| `compat_pair` | 456-475 | activation tiers, `synthesis_a/b`, `connection_structure`, `relational_field`, `relational_weather_v1`, `signatures`, `significance`, `interaction_map`, `musical`, depth panels, `audio_staging`, `audio_thread` |
| `group` | 478-494 | `ensemble_framing`, `group_key_interactions_v1`, `relational_field`, `relational_weather_v1`, `signatures`, `significance`, `field_distribution`, `synthesis_a/b`, `subcluster`, `musical`, depth panels, `audio_staging`, `audio_thread` |

### Duplication Branch

- File: `vnext/projection/rule-layer/assemble-sections.ts`
- Lines: 1343-1346

```ts
const skipCompatSynastryLibraryDup =
  effSurface === 'compat_pair' && options.pairInteractionAspectsV2 != null;
```

Impact: compat V2 skips duplicate synastry-library append in `signatures`; group does not. This is the direct cause of group `group_key_interactions_v1` / `signatures` duplication.

### Relational Branches

- `assemble-sections.ts:1492-1500`: group without class code uses `getRelationalInsight('GROUP_RELATIONAL_FIELD_NEUTRAL')`.
- `assemble-sections.ts:1501-1527`: compat class code uses `getRelationalInsight(classCode)`.
- `assemble-sections.ts:1529-1546`: weather theme uses `getRelationalInsight(primaryTheme)`.

Impact: `relational_field` and `relational_weather_v1` cannot be treated as pure template without losing library content.

### Preface Branches

- `connection-preface.ts:144-153`: compat pair emits `connection_structure`.
- `connection-preface.ts:155-164`: group emits `ensemble_framing` unless suppressed.
- `assemble-sections.ts:2192-2201`: all sections pass through `applyConnectionPreface()`.

### Audio Branches

- `audio-lexicon.ts:335-344`: `surfaceLead` variants per surface.
- `audio-lexicon.ts:353-361`: expanded/extended narrative plan additions.
- `assemble-sections.ts:2098-2152`: baseline truncates clauses; expanded/extended keeps full audio text and bullets.
- `assemble-sections.ts:2154-2174`: extended non-sandbox inserts `audio_thread`.

### Schema / Expansion Branches

- `surface-schemas.ts:23-99`: expansion keys per surface.
- `surface-schemas.ts:102-108`: `expansionKeysFor(surface, tier)`.

Impact: deleting expansion sections requires updating `surface-schemas.ts`, or old expansion keys will continue to request deleted paths.

---

## RISKS IDENTIFIED

1. **Downstream API mappings depend on legacy IDs.** `compose.ts` still maps `signatures`, `significance`, `musical`, and `relational_field` into response fields.
2. **Validation/density repair may reintroduce filler.** `baselineMinSections` and depth panel fill loop can add `depth_panel_N` content unless schema counts are updated.
3. **`significance` is not pure template.** It can render structural insights; deleting it wholesale loses possible library-backed content.
4. **`relational_field` is not pure template.** It can render relational library content; deleting it wholesale loses compatibility/class copy.
5. **Group synastry duplication is real.** `group_key_interactions_v1` is library-owned, but `signatures` also appends top synastry aspects for group.
6. **`audio_staging` is not fully pure library yet.** It falls back to legacy clause fusion when audio library coverage is incomplete.
7. **Legacy explainer renderer still exists.** `vnext/explainer/renderers/deterministic.ts` has a separate three-section architecture and must be declared dead or migrated.
8. **Post-processing references removed sections.** `composition-phase4.ts`, `tone-pass.ts`, `repetition-collapse-phase0.ts`, and scripts have section-rank and relocation assumptions.
9. **`SemanticCore.text` is part of schema validation.** Projection can stop using it before the schema removes it, but schema cleanup is a separate phase.

---

## RECOMMENDATIONS

1. **Phase 2 should be output ownership first, deletion second.** Do not delete `template-lines.ts` immediately.
2. **Create library-only section builders.** Build explicit helpers for aspect, relational, structural, and audio sections.
3. **Make group ownership strict.** `group_key_interactions_v1` should be the only group synastry-aspect owner.
4. **Skip sections without library content.** Do not fall back to claim bundles, padding, or generic template paragraphs.
5. **Update `compose.ts` before removing legacy IDs.** Response fields need a compatibility mapping to new owners, e.g. `aspects`/`group_key_interactions_v1` for old `signatures`.
6. **Update schemas and validation with section removal.** Reduce `baselineMinSections`; remove expansion keys for deleted sections.
7. **Remove hedge injection last.** It currently papers over template/filler prose. Once legacy prose is gone, remove prefix insertion but keep logging/violations if useful.
8. **Treat `SemanticCore` as data authority, not prose authority.** Keep claims/audio/tone metadata as inputs, but remove `emphasis_order` as projection spine.

---

## READY FOR PHASE 2?

**WITH MODIFICATIONS.**

Phase 2 should not proceed as simple deletion of all Category A candidates listed in the master plan. Required modifications:

1. Reclassify `significance`, `relational_field`, `relational_weather_v1`, `feed_signal`, `feed_context`, `depth_panel_N`, and `audio_staging` as mixed or fallback-dependent.
2. Update `compose.ts` response mapping in the same phase that removes `signatures`/`significance`/`musical` public outputs.
3. Update `surface-schemas.ts` and validation before or alongside section removal.
4. Preserve library paths first, then delete dead legacy functions after smoke tests pass.
5. Include `vnext/explainer/renderers/deterministic.ts` in either the removal scope or the explicit dead-path inventory.

Recommended Phase 2 start:

1. Add/confirm smoke tests and banned-string assertions.
2. Disable group `signatures` aspect append by making `group_key_interactions_v1` sole group synastry owner.
3. Stop emitting `musical`, `audio_thread`, `connection_structure`, and `ensemble_framing`.
4. Update response mapping and schema counts.
5. Only then proceed to mixed-section surgery.

