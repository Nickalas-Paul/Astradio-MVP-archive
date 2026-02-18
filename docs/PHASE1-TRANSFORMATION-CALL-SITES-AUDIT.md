# Phase 1: Transformation Call Sites Audit

**Date:** 2026-02-15  
**Purpose:** Document all locations where chart transformations are invoked to ensure complete consolidation.

---

## 1. Chart Snapshot Generation

| File | Function/Method | Call Pattern | Notes |
|------|----------------|--------------|-------|
| `server/index.js` | `GET /api/chart-snapshot` (lines 1100-1150) | HTTP endpoint | **Primary production path** |
| `vnext/api/compose.ts` | `fetchChartSnapshot()` (lines 662-694) | Internal fetch to `/api/chart-snapshot` | Used by compose |
| `vnext/compat/comparison-service.ts` | `fetchChartSnapshot()` (lines 19-25) | Internal fetch | Used for compatibility comparisons |
| `vnext/compat/profile-chart.ts` | `fetchChartSnapshot()` (lines 16-25) | Internal fetch | Used for profile chart generation |
| `vnext/compat/matches.ts` | `fetchChartSnapshot()` (lines 13-22) | Internal fetch | Used for compatibility matching |
| `services/ephemeris/index.ts` | `getChartData()` | Direct Swiss Ephemeris | **Alternate path** - not wired to chart-snapshot route |

**Summary:** 5 call sites via HTTP fetch to `/api/chart-snapshot`, 1 alternate direct path.

---

## 2. encodeFeatures() Calls

| File | Function/Method | Call Pattern | Notes |
|------|----------------|--------------|-------|
| `vnext/api/compose.ts` | `compose()` (line 70) | `encodeFeatures(snapshot)` | **Primary compose path** |
| `vnext/compat/comparison-service.ts` | `createComparison()` (lines 81-82) | `encodeFeatures(snapA)`, `encodeFeatures(snapB)` | Compatibility comparison |
| `vnext/compat/profile-chart.ts` | `generateProfileChart()` (line 46) | `encodeFeatures(snapshot)` | Profile chart generation |
| `vnext/compat/matches.ts` | `getChartFeatures()` (line 27) | `encodeFeatures(snap)` | Compatibility matching |
| `vnext/scripts/plan-novelty-verification.ts` | Multiple (lines 105, 157, 178) | `encodeFeatures(snapshot)` | Test script |
| `vnext/scripts/provenance-verification.ts` | Multiple (lines 106, 107, 119, 139) | `encodeFeatures(snapshot)` | Test script |
| `vnext/scripts/performance-verification.ts` | `main()` (line 65) | `encodeFeatures(snapshot)` | Test script |

**Summary:** 7 call sites (4 production, 3 test scripts).

---

## 3. guidanceFromFeatures() Calls

| File | Function/Method | Call Pattern | Notes |
|------|----------------|--------------|-------|
| `vnext/plan-generator.ts` | `generatePlanMLOnly()` (line 82) | `guidanceFromFeatures(feat, snapshot, seedStr)` | **Primary plan generation** |
| `vnext/scripts/plan-novelty-verification.ts` | Multiple (lines 106, 158, 179) | `guidanceFromFeatures(feat, snapshot, seed)` | Test script |
| `vnext/scripts/provenance-verification.ts` | Multiple (lines 119, 120) | `guidanceFromFeatures(featVec, snapshot, hash)` | Test script |
| `vnext/scripts/performance-verification.ts` | `main()` (line 66) | `guidanceFromFeatures(featureVec, snapshot, hash)` | Test script |

**Summary:** 4 call sites (1 production, 3 test scripts).

**Note:** `guidanceFromFeatures()` internally calls `computePersonalityProfileV1()`, so personality is computed as part of guidance.

---

## 4. computePersonalityProfileV1() Calls

| File | Function/Method | Call Pattern | Notes |
|------|----------------|--------------|-------|
| `vnext/astro/guidance.ts` | `guidanceFromFeatures()` (line 84) | `computePersonalityProfileV1(feat, chartContext, motionProfile, elementBlend, seed)` | **Only call site** - invoked by guidance |

**Summary:** 1 call site (indirect via guidance).

---

## 5. buildAstroProfile() Calls

| File | Function/Method | Call Pattern | Notes |
|------|----------------|--------------|-------|
| `vnext/explainer/text-generation-engine.ts` | `buildExplainSpecSingle()` (line 87) | `buildAstroProfile(snapshot)` | ExplainSpec generation |

**Summary:** 1 call site (explainer only).

---

## 6. Personality Data in Compose Pipeline

### Current Flow in `vnext/api/compose.ts`:

1. **Line 69:** `snapshot = await this.fetchChartSnapshot(request)`
2. **Line 70:** `featureVec = encodeFeatures(snapshot)`
3. **Line 76:** `generatePlanMLOnly(featureVec, payload)` → internally calls `guidanceFromFeatures()` which computes personality
4. **Line 113:** `guidanceSummary = guidanceSummaryFromFeatureVec(featureVec)` (for explainer)
5. **Line 117:** `buildExplainSpecSingle()` → calls `buildAstroProfile(snapshot)` internally

**Key Finding:** Compose computes snapshot → features → guidance (which includes personality) → plan, but does NOT expose personality or astroProfile as first-class outputs. They are embedded in guidance and explainer.

---

## 7. Compatibility/Comparison Paths

### `vnext/compat/comparison-service.ts`:
- Lines 78-79: Fetches snapshots A & B
- Lines 81-82: Encodes both with `encodeFeatures()`
- Line 84: Merges feature vectors (no guidance/personality computed here)
- Line 95: Calls `composeAPI.composeFromFeatures()` which internally computes guidance

### `vnext/compat/profile-chart.ts`:
- Line 45: Fetches snapshot
- Line 46: Encodes with `encodeFeatures()`
- Uses compose API for explainer (personality not directly exposed)

---

## 8. Test Scripts

| Script | Transformations Used | Purpose |
|--------|---------------------|---------|
| `plan-novelty-verification.ts` | snapshot → encodeFeatures → guidanceFromFeatures | Verify plan novelty |
| `provenance-verification.ts` | snapshot → encodeFeatures → guidanceFromFeatures | Verify provenance chain |
| `performance-verification.ts` | snapshot → encodeFeatures → guidanceFromFeatures | Performance testing |
| `compose-determinism-soak.ts` | Mocks chart-snapshot fetch | Determinism verification |
| `compat-determinism.ts` | Mocks chart-snapshot fetch | Compatibility determinism |

---

## 9. Summary: Consolidation Targets

### Primary Production Paths:
1. **Compose:** `fetchChartSnapshot()` → `encodeFeatures()` → `generatePlanMLOnly()` → `guidanceFromFeatures()` → personality embedded
2. **Compatibility:** `fetchChartSnapshot()` (A & B) → `encodeFeatures()` (A & B) → merge → `composeFromFeatures()` → guidance embedded
3. **Profile Chart:** `fetchChartSnapshot()` → `encodeFeatures()` → compose API → explainer uses `buildAstroProfile()`

### Consolidation Strategy:
- **Single entry point:** `generateArchitecture(chartInput)` → { snapshot, features, personality, astroProfile, guidance }
- **Compose refactor:** Replace lines 69-70 + plan-generator's internal guidance call with `generateArchitecture()` consumption
- **Compatibility refactor:** Use `generateArchitecture()` for A and B separately, then merge features
- **Personality API:** New route that calls `generateArchitecture()` and returns personality + astroProfile + narrative

---

## 10. Hidden Paths Check

✅ **No duplicate encoding logic found** (legacy `lib/features/feature-encoder.js` is unused)  
✅ **No alternate snapshot generation** (except `services/ephemeris/index.ts` which is not wired)  
✅ **Personality only computed via guidance** (no direct calls to `computePersonalityProfileV1`)  
✅ **AstroProfile only computed in explainer** (single call site)

**Conclusion:** All transformation paths are accounted for. Consolidation is safe.
