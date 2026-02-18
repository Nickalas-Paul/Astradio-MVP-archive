# Phase 2: Compatibility Refactor + GroupProfile Foundation

## Call sites refactored to architecture-engine

All compatibility transformation flows now use **`vnext/core/architecture-engine.ts`** as the single entry point. No production compat/community code calls `encodeFeatures` directly.

| File | Change |
|------|--------|
| **vnext/compat/comparison-service.ts** | Removed direct `fetchChartSnapshot` + `encodeFeatures`. For chart A and B: `generateArchitecture(chartToChartInput(chart))` once each; merge feature vectors with existing `mergeFeatureVectors`; compose/payload/storage unchanged. |
| **vnext/compat/profile-chart.ts** | Removed `fetchChartSnapshot` and `encodeFeatures`. Single `generateArchitecture(chartToChartInput(chart), seed)`; explainer built from `architecture.features` and existing `composeAPI.getExplainerSectionsForFeatures`. |
| **vnext/compat/matches.ts** | Removed `fetchChartSnapshot` and `encodeFeatures`. `toVec64(chart)` now returns `generateArchitecture(chartToChartInput(chart), chart.id).then(arch => arch.features)`. Scoring and sorting logic unchanged. |

## New surface

- **GroupProfile** (`vnext/community/group-profile.ts`): aggregate of member artifacts only. **No synthetic snapshot**: we do not reverse-engineer EphemerisSnapshot from FeatureVec. When `chartIds` are provided, the API resolves each via `generateArchitecture()` and aggregates features + personality + guidance (deterministic mean). When only `featureVecs` are provided, output is `featuresAgg` + minimal explanation (no personalityAgg/guidanceAgg). No compose/music/gates.
- **APIs**: POST `/api/community/groups/profile`, POST `/api/compatibility/intent` (curated clusters; no ranked list).

## Response shape changes (Phase 2 cleanup)

- **GroupProfileOutput**: `astroProfileAgg` removed (it required a synthetic snapshot). Required: `groupId`, `memberCount`, `featuresAgg`, `explanation`, `updatedAt`. Optional: `personalityAgg`, `guidanceAgg` (only when member artifacts are provided, i.e. when request uses `chartIds`).

## Verification

- `vnext/scripts/phase2-verification.ts`: fixed seeker → intent 3 runs, fixed chartIds → group profile 3 runs; asserts identical cluster output and identical `featuresAgg`.
- No production compat/community file calls `encodeFeatures` directly (only `vnext/core/architecture-engine.ts` and test/scripts may).
- Group profile and compatibility intent do not invoke compose, music, or gates.
- **Synthetic snapshot removed**: no `syntheticSnapshotFromFeatures` or fake snapshot usage in GroupProfile.

## Verification results (Phase 2 cleanup)

- **Build**: `npm run vnext:build` — **PASS** (green).

### How to run Phase 2 verification

1. **Start the engine server** (required for script to hit localhost:3000):
   - `node server/index.js` — or `npm run start` / `npm run dev`.
   - Optional env: `API_BASE_URL` / `ENGINE_BASE_URL` (default `http://localhost:3000`).
2. **Run the script** (after `npm run vnext:build`):
   - `node dist/vnext/vnext/scripts/phase2-verification.js`
   - Run 2–3 times to confirm stable checksums.

### Run results (3 runs)

| Run | Result | INTENT_CHECKSUM | GROUP_PROFILE_CHECKSUM |
|-----|--------|-----------------|-------------------------|
| 1   | **PASS** | `de9424e2a123528b211eba4bc8af85c25538cdf28b95e732f87422511a63e1f3` | `42776c6471f8dfc0402a9a86fc6a20af61616cc1f4f7d2afb3ff75c9cace221d` |
| 2   | **PASS** | `de9424e2a123528b211eba4bc8af85c25538cdf28b95e732f87422511a63e1f3` | `42776c6471f8dfc0402a9a86fc6a20af61616cc1f4f7d2afb3ff75c9cace221d` |
| 3   | **PASS** | `de9424e2a123528b211eba4bc8af85c25538cdf28b95e732f87422511a63e1f3` | `42776c6471f8dfc0402a9a86fc6a20af61616cc1f4f7d2afb3ff75c9cace221d` |

- **Stability**: Identical compatibility intent clusters across runs (ids/labels/bands/member ordering). Identical GroupProfile `featuresAgg` across runs. Checksums are sha256 of the canonical comparison payload (normalized clusters JSON for intent, `featuresAgg` JSON for group profile).
- **Contract**: Intent response has no percentages and no global ranked list (curated clusters only). Server logs showed no `/api/compose` or music/gates traffic for POST `/api/compatibility/intent` or POST `/api/community/groups/profile` during verification.
- Without the server running, the script exits with ECONNREFUSED (expected).

## Phase 3 TODOs (no UI in Phase 2)

- UI for group profiles (e.g. group page with aggregate personality/guidance).
- Constellation rendering for compatibility intent (visual clusters).
- Moderation and persistence for groups (e.g. store group profiles, link to community).
