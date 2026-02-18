# Community Compatibility / Chart Mapping — V1 Design

**Status:** Proposal  
**Date:** 2026-02-07  
**Constraint:** Additive only. No changes to core audio planner or compose pipeline logic. All compatibility outputs use the same deterministic plan + composition path.

---

## 1. Proposed schema refinements

### 1.1 User (minimal profile)

V1 stays auth-agnostic; identity is a placeholder for future auth.

```ts
interface User {
  id: string;                    // uuid or auth-provider id
  displayName: string;
  email?: string;                 // placeholder; not used for matching in V1
  createdAt: string;              // ISO
  updatedAt: string;
}
```

**Storage:** In-memory or DB. No social graph in V1; `User` is only for “owner” of charts and comparisons.

---

### 1.2 Chart (reusable natal chart)

Must be enough to reconstruct `EphemerisSnapshot` for encoding and to call `/api/chart-snapshot` (date, time, lat, lon).

```ts
interface Chart {
  id: string;
  ownerId: string;                // User.id
  label: string;                  // e.g. "My Natal", "Partner"
  date: string;                   // YYYY-MM-DD
  time: string;                   // HH:mm (local or UTC; store one and document)
  lat: number;
  lon: number;
  timezone?: string;              // optional for display
  createdAt: string;
  updatedAt: string;
}
```

**Refinement:** Add optional `snapshotHash?: string` (SHA256 of canonical EphemerisSnapshot JSON) for cache invalidation and idempotent comparison. V1 can omit and compute on demand.

**Alignment with existing:** `ChartSummary` in the app has `id`, `label`, `createdAt`, `positions?`, `houses?` but no date/time/lat/lon. Extend or map so “saved chart” implies persisted `Chart` (date, time, lat, lon); `positions`/`houses` can be derived from snapshot when needed.

---

### 1.3 Comparison (compatibility run)

Stores one compatibility run: two charts, relationship mode, merged feature vector reference, text, plan hash, composition id.

```ts
type RelationshipMode = 'friends' | 'rivals' | 'lovers' | 'mentor' | 'collaborator' | 'neutral';

interface Comparison {
  id: string;
  chartAId: string;
  chartBId: string;
  relationshipMode: RelationshipMode;
  mergedFeatureVector: number[];  // 64-dim for audit/repro; or store hash only
  compatibilityText: string;     // summary (short + long concatenated or structured)
  planHash: string;               // computePlanHash(plan) — deterministic
  compositionId: string;          // same as planHash or jobId/export id for 60s artifact
  createdAt: string;
  createdBy?: string;             // User.id optional
}
```

**Refinements:**

- **mergedFeatureVector:** Store full 64-dim array for reproducibility and debugging; optional secondary `mergedFeatureHash` (SHA256 of float array) for quick equality checks.
- **compositionId:** Prefer `plan_sha256` from compose response as the canonical composition id so “same plan” = “same composition” without extra tables. If exports use a separate `jobId`, store that as `exportJobId` and keep `compositionId` = plan hash for pipeline identity.
- **compatibilityText:** Structured (e.g. `{ short, long, bullets }`) to align with existing explainer output and future i18n.

---

## 2. Encoder fusion method recommendation

**Constraint:** Do not change `encodeFeatures(snapshot): FeatureVec` in `vnext/feature-encode.ts`. Fusion produces a single 64-dim `FeatureVec` that is passed unchanged into `generatePlanMLOnly(feat, chartContext)`.

### Options evaluated

| Method | Pros | Cons |
|--------|------|------|
| **Averaged merge** | Simple, deterministic, no new params. | Tension/difference between charts is lost; may sound “middle of the road”. |
| **Weighted blend** | Can favor “primary” chart (e.g. user vs partner). | Requires convention for weight (e.g. 0.5/0.5 or 0.6/0.4); relationship mode could select weights. |
| **Aspect tension mapping** | Uses existing aspect/tension semantics (e.g. squares/oppositions). | More logic; must stay in a separate layer so encoder stays read-only. |

### Recommendation: **Weighted blend with relationship-mode weights**

- **Default:** 0.5 / 0.5 so (A + B) / 2 — equivalent to “averaged merge” and fully deterministic.
- **Relationship mode:** Optional weights per mode (e.g. `lovers: [0.5, 0.5]`, `mentor: [0.4, 0.6]` for A = mentee, B = mentor). Weights applied per dimension: `merged[i] = wA * vecA[i] + wB * vecB[i]`.
- **Future:** A small “aspect tension” layer can sit on top (e.g. boost tension indices 32–33 from both charts’ aspect counts) in the same fusion module without touching the base encoder.

**Implementation shape (new module, no change to encoder):**

- Add `vnext/compat/fusion.ts` (or `vnext/community/fusion.ts`):
  - `mergeFeatureVectors(vecA: FeatureVec, vecB: FeatureVec, options?: { wA?: number; wB?: number; relationshipMode?: RelationshipMode }): FeatureVec`
  - Returns new Float32Array(64), so `generatePlanMLOnly(merged, payload)` is unchanged.
- Keep `encodeFeatures` read-only; call it once per chart, then merge.

---

## 3. Endpoint contracts (V1)

### 3.1 Charts

- **POST /api/charts**  
  - Body: `{ ownerId?, label, date, time, lat, lon, timezone? }`  
  - Response: `201` + `Chart` (with `id`, `createdAt`, `updatedAt`).  
  - Creates a reusable chart; no composition yet.

- **GET /api/charts/:id**  
  - Response: `200` + `Chart` or `404`.

- **GET /api/charts?ownerId=** (optional in V1)  
  - List charts for a user; omit if V1 only supports “current user” from session.

### 3.2 Comparisons

- **POST /api/comparisons**  
  - Body: `{ chartAId, chartBId, relationshipMode }`  
  - Optional: `chartB` as inline `{ date, time, lat, lon }` instead of `chartBId` (treat as “anonymous” chart B; persist optionally or ephemeral).  
  - Server: resolve A and B to snapshots (from DB or from chart-snapshot API), encode both, merge features, then call **existing compose path** with a single synthetic request that yields one plan + one 60s composition.  
  - Response: `201` + `Comparison` (including `compatibilityText`, `planHash`, `compositionId`, `mergedFeatureVector` or hash) and optionally the same fields as a minimal compose response (e.g. `hashes.plan_sha256`, `audio` if WAV enabled).

- **GET /api/comparisons/:id**  
  - Response: `200` + `Comparison` or `404`.  
  - Enables “view text + shared soundtrack” and “save / share artifact” via existing composition/export by `compositionId` or plan hash.

**Idempotency (optional but recommended):** For `POST /api/comparisons`, if `chartAId`, `chartBId`, and `relationshipMode` are fixed, consider returning existing comparison when `mergedFeatureVector` (or its hash) matches a previous run, and reuse same `planHash`/`compositionId`. That keeps compatibility auditable and reproducible.

---

## 4. Integration points with existing compose pipeline

### 4.1 Single entry point

- Compatibility **does not** add a new top-level “compose for two charts” path that bypasses the planner.
- Flow: **Comparison service** (new) → resolves two charts → two snapshots → two `FeatureVec`s → **fusion** → one `FeatureVec` + one `ControlSurfacePayload` → **existing** `generatePlanMLOnly(feat, payload)` → **existing** gates → text explainer → **existing** WAV/MIDI render → return plan hash + composition artifact.

### 4.2 Where to plug in

1. **Snapshot resolution**  
   - For `chartAId` / `chartBId`: load `Chart` by id, then call existing `GET /api/chart-snapshot?date=&time=&lat=&lon=` (or equivalent server-side) to get `EphemerisSnapshot` for A and B.  
   - For inline chart B: build query from body and call chart-snapshot once for B.

2. **Feature encoding**  
   - Use existing `encodeFeatures(snapshot)` for A and B (read-only).  
   - New code only: `mergeFeatureVectors(vecA, vecB, { relationshipMode })` in `vnext/compat/fusion.ts`.

3. **Payload for compatibility**  
   - Build one `ControlSurfacePayload` for the “virtual” chart used by explainer/gates: e.g. from a **merged snapshot** (average planets/houses/elements) passed through existing payload-generation logic, or from a small compatibility-specific helper that fills `ControlSurfacePayload` from the merged feature vector (e.g. element_dominance from dominant element of merged elements 27–30).  
   - Existing `generateCompatibilityPayload` in `vnext/api/compose.ts` currently uses two default payloads and a compatibility score; replace or extend so that it is driven by **two real snapshots** (or two payloads derived from them) and a deterministic seed (e.g. `hash(chartAId + chartBId + relationshipMode)`).

4. **Plan and audio**  
   - Call `generatePlanMLOnly(mergedFeatureVec, payload)` once.  
   - Then existing: `runAuditionGates(plan, payload.hash)`, text explainer, `renderWav60s(plan, payload, payload.hash)`, `computePlanHash(plan)`.  
   - Return `plan_sha256` and optional base64 WAV in comparison response; store as `planHash` and `compositionId` in `Comparison`.

5. **Compose API surface**  
   - Option A (recommended): Keep `POST /api/compose` as single-chart (sky / overlay / sandbox). Add `POST /api/comparisons` that internally runs the fusion + one compose flow and persists `Comparison`. No new mode in `ComposeRequest`.  
   - Option B: Add `mode: 'compatibility'` to `ComposeRequest` with `comparisonParams: { chartAId, chartBId, relationshipMode }` and have compose API resolve charts, merge, and run. Same pipeline, different entry (compose route vs comparisons route). Both are valid; A keeps compose strictly single-chart and avoids expanding its contract.

### 4.3 Composition reuse (60s shared track)

- One comparison run ⇒ one plan ⇒ one 60s composition (same MIDI/WAV path as today).  
- “Shared soundtrack” = same plan hash / composition id; playback/download uses existing export or asset URL by `compositionId` (e.g. plan hash) or by export `jobId` if you persist exports.

---

## 5. Risk analysis

| Risk | Mitigation |
|------|-------------|
| **Regression in single-chart compose** | No changes to `encodeFeatures`, `generatePlanMLOnly`, `planFromVector`, or audition gates. Compatibility is a separate entry (comparison service or dedicated mode) that only **feeds** one 64-dim vector and one payload into the existing pipeline. |
| **Determinism** | Fusion is pure (same A, B, mode ⇒ same merged vector). Payload seed from `hash(chartAId, chartBId, relationshipMode)`. Existing plan hash and WAV path remain deterministic. |
| **Encoder drift** | Encoder remains read-only; fusion lives in a separate module and does not change 64-dim semantics beyond producing a valid blended vector. |
| **Compose endpoint behavior** | If compatibility is implemented only under `POST /api/comparisons` and never sends a new mode to `POST /api/compose`, existing soak/e2e tests for compose remain valid. If you add `mode: 'compatibility'`, add tests that assert compose still returns same shape and that single-chart modes are unchanged. |
| **Data model scope creep** | V1 User/Chart/Comparison are minimal. No social graph, no matching, no messaging. Future matching can call the same comparison engine (merge + compose) with chart pairs from a different source. |
| **Stale chart-snapshot** | Charts store date/time/lat/lon; snapshot is always fetched at comparison time, so no stale encoder input. Optional `snapshotHash` on Chart can detect upstream ephemeris changes later. |

---

## 6. Summary

- **Schema:** User (minimal), Chart (date/time/lat/lon + label/owner), Comparison (chartAId, chartBId, relationshipMode, mergedFeatureVector, compatibilityText, planHash, compositionId).
- **Fusion:** New module; weighted blend (default 0.5/0.5) with optional relationship-mode weights; output single 64-dim `FeatureVec` into existing planner.
- **API:** `POST/GET /api/charts`, `POST/GET /api/comparisons`; comparisons run fusion then existing plan + composition pipeline once.
- **Integration:** Resolve charts → snapshots → encode A & B → merge → one payload → `generatePlanMLOnly` → gates → text → WAV/MIDI; no changes to encoder or planner internals.
- **Risks:** Additive design and deterministic fusion keep production compose path and regression surface unchanged; optional idempotency on comparisons improves auditability.

This keeps the community compatibility track parallel and non-disruptive to planner and sound design work.

---

## 7. V1 implementation: how to call APIs and verify determinism

### Hitting the endpoints

Base URL is the engine (e.g. `http://localhost:3000`). If using the Next.js app, use same-origin `/api/charts` and `/api/comparisons` (they proxy to the engine).

**Create a chart**
```http
POST /api/charts
Content-Type: application/json

{ "label": "My Natal", "date": "1990-01-15", "time": "12:00", "lat": 40.7128, "lon": -74.006 }
```
Optional: `ownerId`, `timezone`, `snapshotHash`.

**Get a chart**
```http
GET /api/charts/:id
```

**Create a comparison** (chart B can be inline)
```http
POST /api/comparisons
Content-Type: application/json

{
  "chartAId": "<chart-id>",
  "chartBId": "<chart-id>",
  "relationshipMode": "friends"
}
```
Or with inline chart B:
```json
{
  "chartAId": "<chart-id>",
  "chartBInline": { "date": "1992-06-01", "time": "14:30", "lat": 34.05, "lon": -118.25 },
  "relationshipMode": "lovers"
}
```
Optional: `fusion`: `{ "wA": 0.5, "wB": 0.5 }`, `generateComposition`: true, `createdBy`: string.

**Get a comparison**
```http
GET /api/comparisons/:id
```

### Verifying determinism

- **Compose unchanged:** Run the existing compose determinism soak (e.g. `vnext/scripts/compose-determinism-soak.ts`) or a single golden request and assert `hashes.plan_sha256` is non-empty and stable across runs with the same request body.
- **Comparisons deterministic:** Run `vnext/scripts/compat-determinism.ts`. It (1) runs one fixed compose request and checks `plan_sha256` is present, and (2) calls the comparison flow twice with the same chart A/B and relationship mode and asserts the two runs yield the same `planHash` and `mergedFeatureHash`.

```bash
# From repo root after building vnext
npx ts-node -P vnext vnext/scripts/compat-determinism.ts
# or: node dist/vnext/vnext/scripts/compat-determinism.js
```
Exit code 0 means all checks passed.
