# Platform Architecture Audit + Parallel Pillar Restructure

**Date:** 2026-02-15  
**Scope:** Read-only audit; no code changes  
**Goal:** Orient development around three parallel product pillars while retaining the music engine as an experiential output layer.

---

## 1. Executive Summary

The Astradio platform has substantial infrastructure that already supports—or partially supports—the three primary pillars. **Chart data infrastructure is mature and forms a solid shared base.** The Personality Mapping Engine has a strong foundation (PersonalityProfileV1, AstroProfile, guidance logic). Compatibility Mapping has a working V1 comparison pipeline and fusion logic, but synastry calculations and user matching are mock-only. Sandbox/Education has chart editing surfaces and sandbox compose mode, but lacks guided exploration pathways. The music engine is well-structured and can consume outputs from any pillar via the shared feature vector and guidance layer.

**Key Finding:** You are closer to the parallel-pillar model than it may feel. The chart engine underpins everything. The main gaps are: (1) personality/compatibility as first-class UX outputs rather than music-only inputs, (2) real synastry for compatibility scoring, (3) guided sandbox/education flows, and (4) unified chart storage and API wiring.

---

## 2. Current Infrastructure Map

### A) Chart Data Infrastructure

| Component | Location | Responsibility | Stability | Reusability |
|-----------|----------|----------------|-----------|-------------|
| **Swiss Ephemeris (prod path)** | `server/index.js` 370–506, 1085–1126 | Julian Day, positions, Placidus cusps, aspects, moon phase, dominant elements; `GET /api/chart-snapshot` | ✅ Stable | High (all pillars) |
| **Ephemeris service (alt)** | `services/ephemeris/index.ts` | `getChartData`, `getPlanetPositions`, chart-hash cache, Placidus/equal houses | ⚠️ Alternate path | Medium (not wired to chart-snapshot) |
| **EphemerisSnapshot contract** | `vnext/contracts.ts`, `types/astro.d.ts` | `ts`, `tz`, `lat`, `lon`, `houseSystem`, `planets`, `houses`, `aspects`, `moonPhase`, `dominantElements` | ✅ Stable | High |
| **Planet set** | Server `PLANET_ORDER` | sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto | ✅ Fixed | High |
| **Aspect calculation** | `server/index.js` `calcAspects` | conjunction, opposition, trine, square, sextile (orb rules: 6–8°) | ✅ Deterministic | High |
| **House calculation** | Server `calcPlacidusCusps`, services/ephemeris | Placidus; fallback equal houses | ✅ Deterministic | High |
| **Chart hash** | `lib/hash/chartHash.ts` | SHA256 for cache keys, idempotency | ✅ Stable | High |
| **Chart storage (compat)** | `vnext/compat/storage.ts` | In-memory `Chart` (id, ownerId?, label, date, time, lat, lon, timezone?) | ⚠️ Ephemeral | Medium |
| **Chart schema (design)** | `docs/COMMUNITY-COMPATIBILITY-V1-DESIGN.md`, `vnext/compat/types.ts` | `Chart` with `snapshotHash?` for cache invalidation | Design only | High |

**Data Contracts:**
- `Chart` (V1): id, ownerId, label, date, time, lat, lon, timezone?, snapshotHash?, createdAt, updatedAt
- `EphemerisSnapshot`: ts, tz, lat, lon, houseSystem, planets, houses (12), aspects, moonPhase, dominantElements
- ASC/MC/IC/DSC: Implicit as houses[0], houses[9], houses[3], houses[6]

**Node/angle handling:** Nodes (north/south) and extras (Chiron, Lilith, etc.) are computed in server `calcPositions` but not included in EphemerisSnapshot; only PLANET_ORDER planets are exposed.

---

### B) Feature Encoding / Mapping Logic

| Component | Location | Responsibility | Stability | Reusability |
|-----------|----------|----------------|-----------|-------------|
| **64-dim encoder** | `vnext/feature-encode.ts` | `encodeFeatures(snapshot)` → Float32Array(64): planets 0–9, houses 10–21, aspect counts 22–26, elements 27–30, moon phase 31, tension 32, cluster 33, pad 34–63 | ✅ Read-only, deterministic | High |
| **PersonalityProfileV1** | `vnext/astro/personality-profile.ts` | Temperament (activation, stability, expressiveness, warmth, cohesion, gravity); subsystems (moon, sun, mercury, venus, mars, saturn, outers); emphasis (innerWorld, relational, publicRole, voiceSelf); reveal (encounter/recognition/integration) | ✅ Pure, deterministic | High |
| **Guidance layer** | `vnext/astro/guidance.ts` | `guidanceFromFeatures(feat, snapshot, seed)` → tempoBias, arcBias, densityBias, motifIdx, cadenceIdx, elementBlend, motionProfile, narrativeArc, personality | ✅ Pure, deterministic | High |
| **AstroProfile** | `vnext/astro/profile-from-snapshot.ts` | Sign/house/angle placement, orb tightness, prominent planets/aspects; psychology-neutral structured facts | ✅ Deterministic | High |
| **Mapping tables** | `vnext/explainer/mapping-tables-v1.json`, `mapping-tables-v2.json` | Arc, movement, rhythm, density, motif, element tints; V2 adds psychology/temperament language | ✅ Versioned | Medium |
| **Legacy encoder** | `lib/features/feature-encoder.js` | Unused; safe to remove | ❌ Deprecated | None |

**ML vs rule-based:** The 64-dim vector is rule-based; ML (student model) maps 64→6 for composition only. Personality and guidance are fully rule-based.

**Extensibility:** PersonalityProfileV1 and AstroProfile are rich enough for personality reports; mapping tables can be extended for new trait descriptors and archetypal outputs.

---

### C) Comparison / Overlay Systems

| Component | Location | Responsibility | Stability | Reusability |
|-----------|----------|----------------|-----------|-------------|
| **Fusion** | `vnext/compat/fusion.ts` | `mergeFeatureVectors(vecA, vecB, {relationshipMode, wA, wB})` → single 64-dim; weighted blend (default 0.5/0.5; mentor 0.4/0.6) | ✅ Deterministic | High |
| **Comparison service** | `vnext/compat/comparison-service.ts` | Resolve charts → fetch snapshots → encode A & B → merge → `composeFromFeatures` → persist Comparison | ✅ Working | High |
| **Compat routes** | `vnext/compat/routes.ts` | POST/GET /api/charts, POST/GET /api/comparisons | ✅ Mounted | High |
| **Compat storage** | `vnext/compat/storage.ts` | In-memory users, charts, comparisons | ⚠️ Ephemeral | Medium |
| **CompareChartsPanel** | `apps/web/src/components/community/CompareChartsPanel.tsx` | Create charts, run comparison, display compatibility text, planHash | ✅ Working | High |
| **Overlay page** | `apps/web/app/overlay/page.tsx` | Natal vs Today; dual chart display; `handleGenerate` stubbed | ⚠️ Partial | Medium |
| **ExplainSpec comparison** | `vnext/explainer/text-generation-engine.ts` `buildExplainSpecComparison` | Build comparison ExplainSpec from A, B, delta; sections: Shared Signatures, Friction/Growth, Musical Relationship | ✅ Implemented | High |
| **Compat matcher** | `server/compat/matcher.ts` | `generateMatches({chartId, facets, limit})`; uses mock synastry | ⚠️ Mock only | Low |
| **Compat score** | `server/compat/score.ts` | `scoreCompatibility({facet, A, B, syn})`; cosine similarity + synastry bonuses/penalties | ✅ Rule-based | High |
| **Compat schema** | `server/compat/schema.sql` | compat_profiles, compat_cache, compat_pairs | Design/DB | High |
| **Compat routes (matcher)** | `server/routes/compat.ts` | GET /api/compat/matches, GET /api/compat/health | ❌ Not mounted | Blocked |

**Synastry:** Real synastry (A’s planets vs B’s planets, house overlays) is **not implemented**. Matcher uses `generateMockSynastryFeatures()`. Comparison flow uses feature-vector fusion, not aspect-by-aspect synastry.

---

### D) Text Explainer Engine

| Component | Location | Responsibility | Stability | Reusability |
|-----------|----------|----------------|-----------|-------------|
| **Text Explainer (legacy)** | `vnext/explainer/text-explainer.ts`, `atoms-generator.ts`, `text-realizer.ts` | Control-surface → atoms → short/long/bullets; signatures, significance, musical section | ✅ Deterministic | Medium |
| **ExplainSpec** | `vnext/explainer/spec-contracts.ts`, `text-generation-engine.ts` | Canonical IR; `buildExplainSpecSingle`, `buildExplainSpecComparison` | ✅ Deterministic | High |
| **Deterministic renderer** | `vnext/explainer/renderers/deterministic.ts` | ExplainSpec → ExplanationSection[] | ✅ Deterministic | High |
| **AstroProfile integration** | `text-generation-engine.ts` | Prominent planets/aspects, factor map (astro → psych → music) | ✅ Working | High |
| **Prominence** | `vnext/explainer/prominence.ts` | Select prominent factors; orb weighting | ✅ Deterministic | High |
| **Report formatting** | ExplainSpec sections with ids, titles, text, bullets | Structured output | ✅ Stable | High |

**Readiness:**
- **Personality reports:** Psychology facts and AstroProfile feed ExplainSpec; mapping-tables-v2 has psychology/temperament language. Needs a dedicated “personality report” mode and UI.
- **Compatibility reports:** `buildExplainSpecComparison` exists; comparison flow can return `explanation.sections`. Needs wiring to comparison UI and domain-specific copy.
- **Educational explanations:** Element/sign/house/aspect language exists in AstroProfile; can be extended for learning prompts.

---

### E) Sandbox / Simulation Infrastructure

| Component | Location | Responsibility | Stability | Reusability |
|-----------|----------|----------------|-----------|-------------|
| **Sandbox page** | `apps/web/app/sandbox/page.tsx` | WheelCanvas, GenerateCard, LayerMixer, VizCanvas; compose with mode `sandbox` and controls | ✅ Working | High |
| **Sandbox compose** | `vnext/api/compose.ts` `generateSandboxPayload` | Merge default payload with user controls (arc_shape, density_level, tempo_norm, etc.) | ✅ Working | High |
| **Overlay compose** | `vnext/api/compose.ts` `generateOverlayPayload` | Natal + current sky payloads | ✅ Working | Medium |
| **WheelCanvas** | `apps/web/src/components/WheelCanvas.tsx` | Chart visualization | ✅ Working | High |
| **Add Elements** (sandbox) | Sandbox UI | “+ Add Planet”, “+ Add Sign” buttons; currently stubbed | ⚠️ Stub | Low |
| **Golden sandbox inputs** | `vnext/eval/golden-set.json` | Fixed sandbox requests for eval | ✅ Stable | Medium |

**Current functionality:** User can adjust controls (arc_shape, density_level, etc.) and generate compositions. Chart editing (placement manipulation, hypothetical charts) is **stub-level** (“Add Planet”, “Add Sign” do not persist placements).

**Integration with explainer:** Sandbox uses same compose path → same text explainer. No dedicated “learning prompts” or “archetype simulation” tools.

---

### F) Music Engine (Contextual Audit Only)

| Stage | Location | Responsibility |
|-------|----------|----------------|
| **Chart → Snapshot** | `server/index.js` GET /api/chart-snapshot | EphemerisSnapshot |
| **Snapshot → Features** | `vnext/feature-encode.ts` | 64-dim FeatureVec |
| **Features → v6** | `vnext/ml/index.ts` | studentVector(64→6) |
| **Guidance + v6 → Plan** | `vnext/plan-generator.ts`, `vnext/planner/narrative.ts` | Plan (events, bpm, key) |
| **Plan → Audio** | `vnext/audio/wav-renderer.ts` | 60s WAV; Performance v2, Instrumentation v1/v2, FX routing |
| **Browser playback** | `apps/web` engine selection | plan + seed + genre → Tone.js / samples / SoundFont |

**Integration points with chart:**
- FeatureVec (64-dim) is the main chart-derived input to music.
- Guidance (tempoBias, arcBias, densityBias, motifIdx, cadenceIdx) and PersonalityProfileV1 bias plan generation (velocity, phrase structure, etc.).
- Music does not consume PersonalityProfileV1 or compatibility scores directly as UX outputs; they influence plan parameters.

**Where personality/compatibility could later integrate:** Feed PersonalityProfileV1 or compatibility deltas into narrative planner or guidance for “personality-themed” or “relationship-themed” compositions. No structural changes required; extend guidance/plan inputs.

---

## 3. Pillar Readiness Assessment

| Pillar | Chart Inputs | Trait Encoders | Narrative Outputs | UI/API | Overall |
|--------|--------------|----------------|-------------------|--------|---------|
| **Personality Mapping** | ✅ Full | ✅ PersonalityProfileV1, AstroProfile | ✅ ExplainSpec, psychology facts | ⚠️ Embedded in compose | **~70%** |
| **Compatibility Mapping** | ✅ Full | ⚠️ Fusion only (no real synastry) | ✅ buildExplainSpecComparison | ⚠️ CompareChartsPanel; matcher not wired | **~55%** |
| **Sandbox / Education** | ✅ Full | ⚠️ Controls only | ⚠️ Same explainer | ⚠️ Stub editing | **~45%** |

---

## 4. Gap Analysis by Pillar

### Personality Mapping Engine

**What exists:**
- Chart inputs: EphemerisSnapshot, FeatureVec, AstroProfile
- Trait encoders: PersonalityProfileV1 (temperament, subsystems, emphasis, reveal), guidance (elementBlend, motionProfile)
- Narrative outputs: ExplainSpec with psychology facts, AstroProfile prominent factors, mapping-tables-v2 (psychology/temperament language)

**What’s missing:**
- **Trait taxonomies:** No formal taxonomy (e.g. Big Five, enneagram, archetypes) mapped from PersonalityProfileV1. Values exist but labels/descriptors are implicit.
- **Psychological mapping layers:** Psychology facts are derived from signatures; no standalone “personality report” that surfaces temperament/subsystems/emphasis as primary content.
- **Visual personality dashboards:** No UI dedicated to PersonalityProfileV1 (radar charts, sliders, archetype badges).
- **API:** No `GET /api/personality/:chartId` or equivalent; personality is computed inside compose/explainer but not exposed as a first-class resource.

---

### Compatibility Mapping Engine

**What exists:**
- Chart overlays: Overlay page (natal vs today); CompareChartsPanel (A vs B)
- Synastry calculations: **None**—matcher uses mock synastry; comparison uses feature-vector fusion only
- Fusion: Weighted blend of 64-dim vectors with relationship-mode weights
- Scoring: `scoreCompatibility` with cosine similarity + synastry bonuses/penalties (when synastry is real)
- Comparison service: Full flow A+B → merged → compose → Comparison persisted
- ExplainSpec comparison: `buildExplainSpecComparison` with Shared Signatures, Friction/Growth, Musical Relationship

**What’s missing:**
- **Real synastry:** Aspect-by-aspect (A’s Sun vs B’s Moon, etc.), house overlays, dignity.
- **Scoring frameworks:** Domain-based compatibility (emotional, communication, conflict, creative) requires real synastry features.
- **Matcher wiring:** `server/routes/compat.ts` (GET /api/compat/matches) is not mounted; CompatibilitySection 404s.
- **UI visualizations:** Comparison results show text/planHash; no synastry chart overlay, no domain breakdown.
- **Compat profiles:** Schema exists; no implementation for “user’s chart + visibility for matching.”

---

### Sandbox / Education

**What exists:**
- Chart editing infrastructure: WheelCanvas, sandbox page layout
- Simulation logic: Sandbox compose mode with user controls; overlay compose
- Golden eval set: Fixed sandbox requests
- ExplainSpec: Can describe arc, movement, density, elements for any chart

**What’s missing:**
- **Placement manipulation:** “Add Planet”, “Add Sign” are stubs; no persistence or recalculation of snapshot from edited placements.
- **Hypothetical chart generation:** No “what if I was born at X” with live recompute.
- **Guided exploration pathways:** No step-by-step tutorials or learning prompts.
- **Learning prompts:** No “explain this placement” or “what does this aspect mean” flows.
- **Archetype simulation tools:** No “explore Aries Sun + Scorpio Moon” style presets.

---

## 5. Shared Systems Overview

All three pillars depend on:

| Shared System | Owner | Consumers |
|---------------|-------|-----------|
| **Chart generation** | server/index.js, services/ephemeris | All pillars |
| **EphemerisSnapshot** | server | All pillars |
| **encodeFeatures** | vnext/feature-encode.ts | Personality, Compatibility, Music |
| **PersonalityProfileV1** | vnext/astro/personality-profile.ts | Music (plan), Personality (future reports) |
| **AstroProfile** | vnext/astro/profile-from-snapshot.ts | ExplainSpec, Personality |
| **ExplainSpec + renderer** | vnext/explainer | All narrative outputs |
| **Chart storage** | vnext/compat/storage (in-memory) | Compatibility, future Personality/Sandbox |
| **Compose pipeline** | vnext/api/compose.ts | Music, Compatibility (merged features) |

**Data reuse strategy:** Single EphemerisSnapshot per chart; single encodeFeatures call; shared contracts (Chart, EphemerisSnapshot, FeatureVec). Avoid recomputing snapshot/features; cache by chart id or (date, time, lat, lon).

---

## 6. Restructure Recommendations

### Module Relocations (Conceptual)

1. **`/shared/chart`** (logical grouping)
   - EphemerisSnapshot types, chart hash, Chart schema
   - Keep `server/index.js` chart-snapshot and `vnext/feature-encode` as-is; document as shared

2. **`/shared/personality`**
   - `vnext/astro/personality-profile.ts`, `vnext/astro/guidance.ts` (personality-related outputs)
   - `vnext/astro/profile-from-snapshot.ts`
   - Expose as services consumable by Personality pillar and Music

3. **`/shared/explainer`**
   - `vnext/explainer/*` (ExplainSpec, renderers, mapping tables)
   - Single narrative pipeline; modes: single, comparison, personality, education

4. **`/pillars/compatibility`**
   - `vnext/compat/*` (fusion, comparison-service, routes, storage)
   - `server/compat/*` (matcher, score, schema)—wire and align with vnext
   - Add synastry calculator (new module)

5. **`/pillars/sandbox`**
   - Sandbox page, overlay page, GenerateCard (sandbox mode)
   - Future: placement editor, hypothetical chart generator, learning prompts

6. **`/pillars/personality`** (new)
   - Personality report API and UI
   - Consumes shared/chart, shared/personality, shared/explainer

7. **`/experiential/music`**
   - Existing compose pipeline, plan generator, WAV renderer, browser engine
   - Unchanged; consumes shared outputs

### API Boundary Definitions

| API | Method | Purpose | Pillar |
|-----|--------|---------|--------|
| `/api/chart-snapshot` | GET | EphemerisSnapshot from date/time/lat/lon | Shared |
| `/api/charts` | POST, GET | Chart CRUD (compat storage) | Compatibility |
| `/api/comparisons` | POST, GET | Create/get comparison | Compatibility |
| `/api/compose` | POST | Single or sandbox composition | Music |
| `/api/profile/chart` | GET | Chart + snapshot + explainer | Personality (partial) |
| `/api/personality/:chartId` | GET | **(New)** PersonalityProfileV1 + narrative | Personality |
| `/api/compat/matches` | GET | **(Wire)** Ranked matches by chartId | Compatibility |
| `/api/compat/health` | GET | Health check | Compatibility |

### Data Reuse Strategies

- **Chart → Snapshot:** Fetch once per (date, time, lat, lon); cache by chart hash.
- **Snapshot → Features:** Single `encodeFeatures` call; cache by snapshot hash.
- **Features → Personality:** `guidanceFromFeatures` + `computePersonalityProfileV1`; cache with feature hash.
- **A + B → Comparison:** Encode both; merge; one compose. Store merged vector and planHash in Comparison.
- **Unified chart store:** Single source (DB or agreed service) for User + Chart; compat_profiles and comparison-service both use it.

---

## 7. Phased Development Plan

Recommended build order based on infrastructure maturity, complexity, and dependencies:

### Phase 1: Foundation (2–3 weeks)

**Goal:** Unify chart storage and wire compat matching.

1. **Mount compat routes:** Mount `server/routes/compat.ts` (or equivalent) so GET /api/compat/matches and GET /api/compat/health are live.
2. **Align contracts:** Hook sends `chartId`; matcher uses real `encodeFeatures` via chart-snapshot (replace mock features in server/compat/features.ts).
3. **Chart persistence:** Replace or supplement in-memory storage with persistent store (DB or file) for charts and comparisons.
4. **Next.js proxy:** Ensure `/api/compat/matches` and `/api/compat/health` proxy to engine so Matches tab works.

**Deliverables:** Matches tab functional; chart/comparison persistence.

---

### Phase 2: Personality Pillar (2–3 weeks)

**Goal:** Personality as first-class output.

1. **Personality API:** Add GET /api/personality/:chartId (or POST with inline chart) returning PersonalityProfileV1 + ExplainSpec sections.
2. **Personality report UI:** Page or section that displays temperament, subsystems, emphasis with visual cues (e.g. sliders, badges).
3. **Trait taxonomy:** Map PersonalityProfileV1 dimensions to human-readable labels (optional: archetype tags).
4. **Reuse:** Consume existing guidance, personality-profile, ExplainSpec; no changes to encoder.

**Deliverables:** Standalone personality report; no dependency on compose/music.

---

### Phase 3: Compatibility Synastry (2–4 weeks)

**Goal:** Real synastry for scoring and narrative.

1. **Synastry calculator:** New module that, given snapshots A and B, computes inter-chart aspects (A’s Sun vs B’s Moon, etc.), house overlays, orb strengths.
2. **SynFeature pipeline:** Replace `generateMockSynastryFeatures` with real synastry output compatible with `scoreCompatibility`.
3. **Domain facets:** Extend scoring for emotional, communication, conflict, creative (if not already present).
4. **Comparison narrative:** Ensure buildExplainSpecComparison consumes real synastry for “Points of Friction and Growth.”
5. **UI:** Synastry aspect list or overlay on CompareChartsPanel.

**Deliverables:** Real compatibility scoring; comparison narrative reflects actual aspects.

---

### Phase 4: Sandbox / Education (3–4 weeks)

**Goal:** Guided exploration and placement editing.

1. **Placement manipulation:** Implement “Add Planet” / “Add Sign” with persistence; recompute or approximate snapshot for hypothetical charts.
2. **Hypothetical chart API:** POST with overrides (e.g. sun_lon, moon_lon) → EphemerisSnapshot-like output for explainer.
3. **Learning prompts:** “Explain this placement,” “What does Sun in Leo mean?”—leverage AstroProfile and mapping tables.
4. **Guided pathways:** Optional step-by-step sandbox flow (e.g. “Set your Sun sign → Explore elements → Hear a composition”).

**Deliverables:** Editable chart sandbox; learning prompts; optional guided flow.

---

### Phase 5: Integration & Polish (1–2 weeks)

**Goal:** Cross-pillar links and UX coherence.

1. **Personality → Compatibility:** “Your temperament” summary in comparison context.
2. **Compatibility → Music:** Optional “relationship theme” in composition (already supported via merged features; add UX hint).
3. **Sandbox → Education:** Link sandbox to learning prompts and archetype presets.
4. **Documentation:** Consolidate audit docs; pillar-based README.

---

## 8. Summary Table

| Pillar | Existing % | Phase | Priority |
|--------|------------|-------|----------|
| Personality | ~70% | 2 | High |
| Compatibility | ~55% | 1, 3 | High |
| Sandbox / Education | ~45% | 4 | Medium |
| Music (experiential) | 100% | — | Retain as-is |

---

*End of audit. No code changes were made. Next steps: choose phase, then implement.*
