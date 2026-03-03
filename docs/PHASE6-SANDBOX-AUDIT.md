# Phase 6 — Sandbox Composition: Repo Audit & Implementation Plan

**Status:** Step 0 complete. **Phase 6 decision and one-page contract:** see **`docs/PHASE6-SANDBOX-CONTRACT.md`** (Option A: audio reflects overrides via minimal compose.ts change; wheel requirements; atomic commit plan; walkthrough).

**Context:** Phase 5 closed. Relational layer live under `/api/relational/*`. Phase 6 goal: Sandbox from concept to beta-ready (UI, playback, save/export, stable flows).

---

## 1. File Map

### 1.1 Sandbox UI entry points

| Location | Purpose |
|----------|---------|
| `apps/web/app/sandbox/page.tsx` | Main Sandbox page. Default birth + snapshot on mount; wheel from snapshot; GenerateCard triggers compose (first time: direct POST /api/compose + sets lastComposition); Download WAV from lastComposition.export_id. **No playback of composed WAV** (no player wired to export URL). Uses useCompositionJob (mock adapter). |
| `apps/web/app/sandbox/builder/page.tsx` | Sandbox Builder. Birth form → snapshot → overrides (WheelCanvasBuilder + DegreePanel) → report → “Generate 30s track” → POST /api/compose with combinedHash seed; Download WAV when export_id present. **No save/list/reload.** |
| `apps/web/src/components/sandbox/BirthDataForm.tsx` | Birth data form (builder). |
| `apps/web/src/components/sandbox/WheelCanvasBuilder.tsx` | Draggable wheel + overrides (builder). |
| `apps/web/src/components/sandbox/DegreePanel.tsx` | Degree inputs (builder). |
| `apps/web/src/types/sandbox.ts` | SandboxDraft, SandboxBirth, SandboxOverrides, EphemerisSnapshot, SandboxReport. |
| `apps/web/src/components/Header.tsx` | Nav link to `/sandbox`. |

**Legacy / alternate:**  
`apps/web/public/sandbox.html` + `sandbox.js` + `wheel.js` — standalone HTML app (Tone.js, unpkg). Not the main Next app. **Isolate or deprecate;** do not treat as canonical Sandbox surface.

### 1.2 Sandbox API routes

| Layer | Path | Handler | Purpose |
|-------|------|---------|---------|
| Next (proxy) | POST `/api/sandbox/*` | `apps/web/app/api/sandbox/[...path]/route.ts` | Forwards to backend `getEngineBaseUrl()/api/sandbox/{path}`. GET → 405. |
| Engine | POST `/api/sandbox/snapshot` | `vnext/api/sandbox-routes.ts` | Body: birth, overrides. Validates overrides; fetches base from /api/chart-snapshot; applies overrides via sandbox-snapshot; returns snapshot + meta (baseHash, overridesHash, combinedHash). |
| Engine | POST `/api/sandbox/report` | `vnext/api/sandbox-routes.ts` | Body: birth, overrides, seed?. Uses generateArchitectureFromSnapshot (architecture-engine). Returns features, personality, guidance, explanation, seed, meta.combinedHash. **No audio.** |
| Engine | POST `/api/compose` | `vnext/api/compose.ts` (ComposeAPI.compose) | Accepts mode `sandbox` with `controls` and optional `chartData`, `seed`. **Sandbox UI currently does not send chartData** — compose uses default chart (date/time/lat/lon defaults) for architecture; only controls + seed drive payload. |

**No** dedicated “sandbox composition” persistence API. No table for saved sandbox compositions.

### 1.3 Audio playback and export flow

| Step | Where | Notes |
|------|--------|------|
| Generate audio | `vnext/api/compose.ts` | generateControlPayload (sandbox → generateSandboxPayload) → generateArchitecture(chartInput, payload.hash) → plan → render (Lyria or local_wav). Export key from payload.hash + provider + modelVersion + promptHash + duration_s. |
| Cache / write WAV | `vnext/render/export-cache.ts` | getCachedWav(exportKey), writeExport(exportKey, buffer, meta). Disk: EXPORT_ROOT/exports (env or cwd/exports). |
| Export ID | Compose response | `export_id` when ENABLE_WAV_EXPORT=1; same value as exportKey (64-char hex). |
| Stream WAV | Engine: GET `/api/exports/:id` | `server/index.js` — exportStore.stream(id, res). exportStore from `lib/export-store.js` (disk or GCS). No requireBeta. |
| Web proxy | GET `/api/exports/:id` | `apps/web/app/api/exports/[id]/route.ts` — proxies to backend; returns binary. |
| DB record | Optional | When POSTGRES_URL: POST /api/exports (requireBeta) calls compose then pgStore.createExportJob(id, planHash, chartHash, filePath, …). astradio_export_jobs (001 + 002 storage_key, export_meta). |
| Playback in UI | Landing: `apps/web/app/page.tsx` | Sets audioUrl from payload.audio.url or base64 blob. Uses native Audio() / Tone. **Sandbox page:** does not set a playable URL from export_id; only Download link. **Builder:** same — Download only. |

**Provider selection:** In compose, render layer uses RENDER_PROVIDER (Lyria vs local_wav). No silent fallback: export failure sets audioDebug (export_failure, step, message) and does not pretend success.

### 1.4 Storage and DB

| Asset | Location | Notes |
|-------|----------|--------|
| WAV files | EXPORT_ROOT/exports (disk) or GCS_BUCKET | Via export-cache (vnext) and export-store (server). |
| Export job rows | astradio_export_jobs | id (PK), request_id, user_id, plan_hash, chart_hash, file_path, content_type, size_bytes, storage_key, export_meta (002). Used when POST /api/exports (requireBeta) and POSTGRES_URL. |
| Sandbox persistence | **None** | No table for “saved sandbox composition” (state + hashes + export ref). Phase 6 needs additive migration. |

### 1.5 Auth

- **Sandbox:** No auth. POST /api/sandbox/snapshot, POST /api/sandbox/report, and POST /api/compose are not gated. Do not add new auth gates in Phase 6 per brief.
- **Exports:** GET /api/exports/:id — no requireBeta. POST /api/exports — requireBeta (server).

---

## 2. Redundancy and Hazards

### 2.1 Redundancies

| Item | Recommendation | Reason |
|------|----------------|--------|
| **Two Sandbox surfaces** | Single canonical route: `/sandbox`. Builder can be the main Sandbox (birth + placements + report + compose) or a sub-route `/sandbox/builder`; main `/sandbox` should be “blank canvas” default per brief. Unify so one surface for “create / edit / play / save / list / reload / export.” | Brief: “single canonical route … do not fork multiple surfaces.” |
| **Main sandbox page vs builder** | Prefer one Sandbox UX: either merge builder into main sandbox (blank canvas → add placements → generate → play/save/export) or make main sandbox a thin entry that redirects to builder. Remove or clearly deprecate duplicate flows. | Avoid two parallel “sandbox” UIs. |
| **useCompositionJob on Sandbox page** | Mock adapter (engine-adapter.ts) does not call real /api/compose; returns fake /media/ URL. Sandbox page calls real compose in handleGenerate when !hasValidInputs, then calls start(request) (mock). **Fix:** Either wire Sandbox to real compose-only flow and remove mock job for sandbox, or make adapter call POST /api/compose and derive audioUrl from export_id (e.g. getApiBaseUrl() + '/api/exports/' + export_id). | Playback and “one-button generate and play” must use real export URL. |
| **POST /api/compositions/generate** (server) | Phase-6 endpoint; calls compose with mode sandbox, writes to EXPORTS_DIR by request_id, returns composition id. Overlaps with POST /api/compose + export_id. **Isolate:** Do not add Phase 6 save/list on this path; use compose + export_id as source of truth. Optionally deprecate or document as legacy. | Single compose pipeline; no alternate “compose-like” endpoints for Sandbox. |
| **public/sandbox.html + sandbox.js** | Standalone HTML app. **Isolate:** Move to a `/legacy` or `docs/` asset, or add a clear “Legacy Sandbox (no save)” label and leave it; do not delete without product decision. | Prefer isolating over deleting. |

### 2.2 Hazards (determinism, drift, failures)

| Hazard | Mitigation |
|--------|------------|
| **Sandbox state not driving compose** | Today: sandbox UIs send mode, controls, seed (combinedHash). They do **not** send chartData. So architecture uses default chart. For “saved sandbox composition” to be reproducible, compose must receive the same chart (birth + overrides). **Plan:** Persist sandbox state (birth + overrides + controls). On “replay” or “reload,” call POST /api/compose with mode sandbox, chartData derived from saved birth+overrides, controls, and saved seed. Compose API already supports chartData in extractChartInput; ensure contract documents chartData for sandbox. |
| **Seed/vector hashing** | One source of truth: use existing canonical hashing (sandbox-snapshot: hashBirth, hashOverrides, combinedHash; compose: payload.hash, computeExportKey). Do not introduce new hashing for sandbox saves; store and reuse combinedHash (and controlsHash if needed) as seed. |
| **Silent failures** | Brief: no silent fallbacks. Compose and export already surface audioDebug/export_error. Sandbox save/list/export must return explicit errors (4xx/5xx + message). |
| **Math.random** | Phase 5 guard already forbids Math.random in relational. Sandbox and compose paths must remain seeded only; no new randomness in runtime. |
| **Phase 5 smoke** | Phase 6 changes must be additive. New Phase 6 smoke script must not replace or break phase5:smoke. |

---

## 3. Phase 6 Implementation Plan (Atomic Commits)

### 3.1 Principles

- One canonical Sandbox route (e.g. `/sandbox`); blank canvas default; optional `/sandbox/builder` as alias or merged.
- All generation via existing POST /api/compose (no new compose-like endpoints).
- Save: new table + API for “saved sandbox composition”; store state (birth, overrides, controls), vector hash (combinedHash), seed, planHash, provider identity, createdAt, export_id/artifact refs.
- WAV export: use existing GET /api/exports/:id (already in place).
- JSON export: additive endpoint or same-page bundle (provenance: inputs, hashes, seed, provider, timestamps, artifact refs).
- Determinism: same state + seed + provider → same planHash and same audio hash (smoke assertion).

### 3.2 Suggested atomic commits

| # | Commit scope | Details |
|---|--------------|--------|
| 1 | **Migration 006** | Additive migration: table e.g. `astradio_sandbox_compositions` (id, owner_id nullable, sandbox_state JSONB, vector_hash TEXT, seed TEXT, plan_hash TEXT, provider TEXT, provider_version TEXT, export_id TEXT, artifact_url TEXT, created_at, updated_at). Indexes: owner_id, created_at, vector_hash. No FK to users if no auth; otherwise optional owner_id. |
| 2 | **Sandbox save API** | Engine or shared: POST /api/sandbox/compositions (body: sandbox state, planHash, seed, provider, export_id, optional title). Validates state; inserts row; returns id, createdAt. GET /api/sandbox/compositions (list, optional owner filter if auth later). GET /api/sandbox/compositions/:id (one by id). Use same DB stack as Phase 4/5 (pg-store or vnext store layer). |
| 3 | **Web proxy for sandbox compositions** | Next: proxy POST/GET /api/sandbox/compositions and GET /api/sandbox/compositions/:id to engine. |
| 4 | **Sandbox UI: single surface** | Unify to one Sandbox page: blank canvas default (no placements). Controls: add/edit/remove placements (birth + overrides); minimal controls that map to ControlSurfacePayload. One-button “Generate and play”: POST /api/compose (with chartData from current state when available), then set playback URL to /api/exports/:export_id and show player (play/stop/replay/download). Clear loading, progress, error states. |
| 5 | **Playback and export UX** | Play: use export URL (same-origin or engine base) for <audio> or existing player. Stop, replay, download (existing link). Error: show message on compose or export failure; no “looks fine” when failed. |
| 6 | **Save and list in UI** | After compose: “Save composition” persists via POST /api/sandbox/compositions. “My compositions” lists GET /api/sandbox/compositions. Open item → load state into Sandbox, then “Replay” = same compose request (state + seed + provider). |
| 7 | **Reload and replay** | Load saved composition by id; restore sandbox state (birth, overrides, controls); show “Replay” which re-runs compose with same seed/state; optionally assert planHash match (read-only check). |
| 8 | **WAV export** | Already present: Download WAV via /api/exports/:id. Ensure link and filename are clear (e.g. export_id-30s.wav). |
| 9 | **JSON export bundle** | Add “Export JSON” (or bundle): download JSON with provenance (sandbox_state, vector_hash, seed, plan_hash, provider, provider_version, createdAt, export_id, artifact_url). No new backend required if client builds from save response + last compose response. |
| 10 | **Phase 6 smoke script** | New script: phase6-smoke.ts (or .js). Steps: (1) Create sandbox state (minimal birth + overrides). (2) POST /api/compose (sandbox, with chartData + seed). (3) Assert response has plan_sha256 and export_id. (4) GET /api/exports/:id → 200 and body. (5) POST /api/sandbox/compositions (save). (6) GET /api/sandbox/compositions → list includes saved. (7) GET /api/sandbox/compositions/:id → reload. (8) Re-run compose with same state+seed → assert planHash match (and optional audio hash). (9) Export WAV (already covered by GET exports). (10) Export JSON (bundle or endpoint). Script runs after vnext build; no network if using local engine. Add npm script phase6:smoke. |
| 11 | **Determinism check in smoke** | In Phase 6 smoke: after save, reload state and seed; POST /api/compose again; assert hashes.plan_sha256 === saved planHash; if audio hash available (e.g. from response or integrity), assert same. |
| 12 | **Guardrails and errors** | Env: document or check ENABLE_WAV_EXPORT, provider config. Provider unavailable / invalid input / export failure: return explicit error payloads (no silent fallback). Sandbox validation: reuse validateSandboxOverrides; 400 on invalid. |
| 13 | **Docs and Phase 5 preservation** | Update Phase 6 doc (this file or PHASE6-CLOSEOUT.md). Ensure phase5:smoke still runs and is unchanged; phase6:smoke is additive. |

### 3.3 Tests and smoke

- **Phase 5:** Leave phase5:smoke and all verify-* scripts unchanged; no edits to architecture-engine, compose, feature-encode.
- **Phase 6 smoke:** New script as above. Assert: create → compose → playback reference (export_id) → save → list → reload → replay (planHash match) → export WAV → export JSON.
- **Determinism:** Same sandbox state + same seed + same provider → same planHash (and same audio hash when available).

### 3.4 Optional cleanup (non-blocking)

- Deprecate or isolate POST /api/compositions/generate for Sandbox flows.
- Isolate or label public/sandbox.html as legacy.
- Unify main sandbox page and builder into one flow (single route, no duplicate “two surfaces”).

---

## 4. Required Final Outcome (Checklist)

After Phase 6:

- [ ] Beta tester opens **Sandbox** (single canonical route).
- [ ] Creates a **sandbox composition** (placements + params; minimal and consistent with feature encoder).
- [ ] **Plays** it (one-button generate and play; clear loading/error).
- [ ] **Saves** it (first-class artifact in DB).
- [ ] **Views saved items** (list).
- [ ] **Reloads and replays** (deterministic planHash where applicable).
- [ ] **Exports WAV** (existing export path).
- [ ] **Exports JSON** (provenance bundle).

---

## 5. Summary

| Area | Finding |
|------|--------|
| **Sandbox UI** | Two surfaces (page + builder); no save/list/reload; main page uses mock job + one-off compose; no playback from export URL. |
| **Sandbox API** | snapshot + report in vnext; compose accepts sandbox mode; no chartData sent from UI; no persistence for compositions. |
| **Playback / export** | Export ID and GET /api/exports/:id work; playback on Sandbox not wired to real WAV; Download link present. |
| **Storage** | WAV on disk/GCS; astradio_export_jobs for job metadata; no sandbox-composition table. |
| **Auth** | Sandbox and compose are open; do not add auth in Phase 6. |
| **Redundancies** | Two UIs; mock job vs real compose; POST /api/compositions/generate; legacy public sandbox. |
| **Hazard** | chartData not sent for sandbox → architecture not driven by placements; must send chartData for replay/save reproducibility. |

Implementation plan: additive migration, save/list/reload API, single Sandbox UX with play/save/list/reload, WAV + JSON export, Phase 6 smoke with determinism check, and explicit errors throughout.

---

## 6. Phase 6 Confirmation: Step 0 (Current Behavior) & Step 1 (Design)

### Step 0: Confirm current behavior against target

#### A) What is the Sandbox “source of truth” chart state today?

- **Exact JSON shape:** The sandbox chart is represented by two structures used together:
  - **Birth:** `{ date: string, time: string, lat: number, lon: number, tz?: string, houseSystem?: string }` — defined as `SandboxBirth` in `apps/web/src/types/sandbox.ts` (lines 8–16) and mirrored in `vnext/contracts.ts` (lines 73–80).
  - **Overrides:** `{ planets: Partial<Record<PlanetKey, { lonDeg: number }>>, angles?: { ascDeg?: number, mcDeg?: number } }` — defined as `SandboxOverrides` in `apps/web/src/types/sandbox.ts` (lines 17–23). Planet longitudes are 0–360; angles exist in the type but are **rejected by the backend** (see C).
- **Does it support:**
  - **Birth inputs (date/time/lat/lon):** Yes. Builder uses `BirthDataForm`; birth is stored in `draft.birth` and sent to POST `/api/sandbox/snapshot` and POST `/api/sandbox/report`.
  - **Manual overrides (per-body longitudes):** Yes. `draft.overrides.planets[planet] = { lonDeg }`; updated via `handleOverrideChange` in `apps/web/app/sandbox/builder/page.tsx` (lines 204–245) and by drag in `WheelCanvasBuilder`.
  - **House system selection:** Yes in the type (`SandboxBirth.houseSystem`) and in hashing (`vnext/api/sandbox-snapshot.ts` `hashBirth` uses `birth.houseSystem || 'placidus'`). The builder form may or may not expose it; the API accepts it.
- **Where defined:** Types in `apps/web/src/types/sandbox.ts`; state is **local component state** only — `draft` in `apps/web/app/sandbox/builder/page.tsx` (lines 87–92). There is no global sandbox store. The main `/sandbox` page does **not** hold overrides; it only has `DEFAULT_SANDBOX_BIRTH`, `snapshotForWheel`, and `sandboxCombinedHash` (`apps/web/app/sandbox/page.tsx`).

#### B) How is the wheel currently populated?

- **`/sandbox` (main page):**
  - **API:** One call on mount: POST `/api/sandbox/snapshot` with `{ birth: DEFAULT_SANDBOX_BIRTH, overrides: { planets: {} } }` — `apps/web/app/sandbox/page.tsx` lines 38–70.
  - **Wheel data:** Response `data.snapshot` is transformed into a `ChartData`-like object: `positions` from `snapshot.planets` (name → lon), `cusps` from `snapshot.houses` (first 12) — same file lines 47–66. That object is stored as `snapshotForWheel` and passed to `WheelCanvas` as `chartData={snapshotForWheel ?? chartData ?? undefined}` (line 160).
  - **Component:** `WheelCanvas` in `apps/web/src/components/WheelCanvas.tsx` — normalizes via `normalizeChartForWheel(chartData)` (from `apps/web/src/core/chart-adapter.ts`), then `WheelSvg` renders houses from `chart.cusps` and planet glyphs from `chart.positions` using `PLANET_GLYPH` (lines 61–101). So **planet glyphs are drawn by `WheelCanvas`** (read-only; no drag on this page).
- **`/sandbox/builder`:**
  - **API:** POST `/api/sandbox/snapshot` on birth submit (body: `{ birth, overrides: { planets: {} } }`) and on every override change (debounced 300ms) with `{ birth, overrides: normalized }` — `apps/web/app/sandbox/builder/page.tsx` lines 104–167 (handleBirthSubmit), 104–167 (updateSnapshot).
  - **Wheel data:** `currentSnapshot = draft.overriddenSnapshot || draft.baseSnapshot` (line 357). Snapshot is `EphemerisSnapshot` (planets array, houses). `WheelCanvasBuilder` receives `snapshot` and `overrides`; it uses `normalizeChartForWheel(snapshot)` then **merges** `overrides.planets` onto positions — `apps/web/src/components/sandbox/WheelCanvasBuilder.tsx` lines 144–159. Houses come from `normalized.cusps` (from snapshot.houses).
  - **Component:** **`WheelCanvasBuilder`** in `apps/web/src/components/sandbox/WheelCanvasBuilder.tsx` — draws houses (arcPath from cusps), then **planet glyphs** as SVG `<text>` with `PLANET_GLYPH[name]` (lines 246–262). Supports pointer down/move/up for drag; `onOverrideChange(planet, lonDeg)` updates parent state; degree rounding is 0.1° via `angleToLonDeg` → `roundDegree` (lines 40–42, 188–189).

#### C) Can a user currently produce “8 planets in Scorpio in the 12th house”?

- **8 planets in Scorpio (by longitude):** Yes. Scorpio ≈ 210°–240° ecliptic. User can set each of 8 bodies to a longitude in that range via:
  - **DegreePanel:** `apps/web/src/components/sandbox/DegreePanel.tsx` — number input 0–360, step 0.1, and “Reset” per planet; `onOverrideChange(planet, roundDegree(val))` (lines 69–81).
  - **Drag:** In `WheelCanvasBuilder`, dragging a planet calls `onOverrideChange(draggingPlanet, lonDeg)` (line 192) with 0.1° rounding.
- **“In the 12th house”:** Only if the **birth chart’s** 12th house spans that longitude. Houses come from the **base snapshot** (birth + lat/lon + date/time). They are **not** user-editable:
  - **Backend:** `vnext/api/sandbox-snapshot.ts` `validateSandboxOverrides` (lines 104–118) **rejects** angle overrides: `if (angles?.ascDeg !== undefined || angles?.mcDeg !== undefined) throw new Error('Angle overrides (ASC/MC) are not supported...')`. So ASC/MC cannot be set.
  - **Engine:** `generateSnapshotWithOverrides` (lines 124–174) only overrides planet longitudes; “Houses remain from base snapshot (not recalculated in 4A)” (line 164).
- **What’s missing for “8 planets in Scorpio in the 12th house” on demand:**
  - **Ability to place planets:** Present (overrides + drag + degree panel).
  - **Ability to control house boundaries:** Missing — no angle (ASC/MC) overrides; houses are fixed by birth.
  - **Ability to force house placement:** Missing — cannot make “12th house” span Scorpio unless that already holds for the chosen birth. So the scenario is only achievable when the birth chart’s 12th house already contains the target longitude range (e.g. Sacramento, Aug 16, 1979 — user would need to check cusps and set planet longitudes within that house’s span).

#### D) Does compose today use the sandbox chart?

- **No.** The Sandbox UI does **not** pass `chartData` into POST `/api/compose`:
  - **Main sandbox:** `apps/web/app/sandbox/page.tsx` lines 96–100: body is `{ mode: 'sandbox', controls, seed }` only. No `chartData`.
  - **Builder:** `apps/web/app/sandbox/builder/page.tsx` lines 328–345: body is `{ mode: 'sandbox', controls, seed: combinedHash }` only. No `chartData`.
- **Compose behavior:** In `vnext/api/compose.ts`, for non-sky/non-overlay, `extractChartInput` uses `req.chartData?.date|time|lat|lon` or **defaults** (today’s date, 12:00, 40.7128, -74.006) — lines 855–859. So when `chartData` is omitted, compose uses those defaults.
- **Conclusion:** Compose is currently driven by **defaults**, not the sandbox chart. That **violates** the product target (“composition generated from that sandbox chart state”). The minimal fix (without editing compose or architecture-engine) is to pass `chartData: { date, time, lat, lon }` from the sandbox **birth** so at least birth drives compose. Note: the compose pipeline does **not** accept overridden planet longitudes; it only accepts `ChartInput` (date, time, lat, lon) and calls `fetchChartSnapshot(input)` in `vnext/core/architecture-engine.ts` (lines 41–52, 70–75). So **audio will always be from the ephemeris snapshot for that birth**, not from manual placements. Viz and report can reflect overrides (they use sandbox snapshot/report); audio reflects birth-only unless the engine is extended (out of scope for Phase 6).

---

### Step 1: Proposed design to meet the target

#### 1. Two modes of chart creation

- **“From birth inputs” mode:** User sets date, time, and location (city or lat/lon). Location is resolved to lat/lon if needed (existing or new geocode path). Submit → POST `/api/sandbox/snapshot` with `{ birth, overrides: { planets: {} } }` → base snapshot and wheel from ephemeris; no overrides.
- **“Manual lab mode”:** After (or instead of) a birth-based snapshot, user adds/edits planet longitudes. Overrides are stored in `draft.overrides`; POST `/api/sandbox/snapshot` with `{ birth, overrides }` returns an overridden snapshot (planets updated, aspects/moon phase recalculated, houses unchanged). This supports “physically impossible” charts (e.g. 8 planets in Scorpio). House boundaries remain from birth unless we add angle-override support later (backend change).

#### 2. Drag-and-drop planets

- **Existing:** `WheelCanvasBuilder` already has draggable planet glyphs and 0.1° snapping (`angleToLonDeg` → `roundDegree`). `DegreePanel` provides numeric 0.1° input and sign-degree display.
- **Enhancements (minimal, safe):**
  - **Sign–degree and house placement display:** Show for each planet “Scorpio 15° 30′” and “House 12” (house index from cusps). Derive house from current cusps and planet longitude (no backend change).
  - **House constraint toggle (default: constrained):** Optional. “Constrain to house” = when dragging, snap longitude to stay within the house the planet started in (client-side clamp to house arc). “Free drag” = current behavior (any 0–360). Implement as a single boolean in sandbox state and a small clamp in the drag handler.
  - **Update overrides only:** Keep the rule that only `overrides.planets` are edited; base snapshot and cusps come from birth (and optionally angles if we add them later).

#### 3. Triple output wiring

- **Viz:** Always from POST `/api/sandbox/snapshot` with current `{ birth, overrides }`. Wheel (WheelCanvasBuilder or WheelCanvas) renders the returned snapshot with overrides merged. Blank canvas = no snapshot until user provides birth (and optionally overrides).
- **Text:** POST `/api/sandbox/report` with same `{ birth, overrides }` and `seed: combinedHash` from snapshot response. UI shows a **report document** panel (personality, guidance, explanation.sections), not raw JSON.
- **Audio:** POST `/api/compose` with:
  - `mode: 'sandbox'`
  - `chartData: { date: birth.date, time: birth.time, lat: birth.lat, lon: birth.lon }` (from current sandbox birth — **fix for D**)
  - `controls` (fixed or from UI)
  - `seed` (e.g. combinedHash or stored seed)
  - No overrides can be passed into compose (engine accepts only ChartInput). So **audio is driven by birth only**; viz and report are driven by birth + overrides. Document this in UI so “audio from this chart” means “audio from this birth chart.”
- All three calls use the **same** sandbox state (birth + overrides) for snapshot and report; same birth for compose. Single “Generate” button orchestrates: snapshot → report → compose; per-output loading and error states.

#### 4. Atomic commit plan (green builds, additive)

| # | Commit | Notes |
|---|--------|--------|
| 1 | **Docs + types: triple-output contract** | Update PHASE6-SANDBOX-AUDIT.md (this section); add/align types for SandboxState (birth + overrides + controls) and saved composition record. No runtime behavior change. |
| 2 | **Compose correctness: pass chartData from sandbox** | In both sandbox page and builder, ensure every POST `/api/compose` (sandbox) includes `chartData: { date, time, lat, lon }` from current `birth`. No edits to vnext/api/compose.ts or architecture-engine. |
| 3 | **Unify Sandbox surface** | Single canonical route `/sandbox`. Merge builder flow into it: birth form → snapshot → overrides (WheelCanvasBuilder + DegreePanel) → one “Generate” that runs snapshot + report + compose. Blank canvas default (no snapshot until birth provided). Deprecate or redirect `/sandbox/builder` to `/sandbox`. |
| 4 | **Triple-output orchestration** | One “Generate” action: (1) POST snapshot → update wheel + combinedHash, (2) POST report → update report panel, (3) POST compose → update audio panel. Per-output loading/error; no silent success on failure. |
| 5 | **Playback from export_id** | Wire audio player to `/api/exports/:export_id` (play/stop/replay + download). Remove reliance on mock composition job for Sandbox. |
| 6 | **Migration 006 + save/list API** | Table for saved sandbox compositions (state, vector_hash, seed, plan_hash, report JSON, provider, export_id, timestamps). POST/GET list/GET by id; proxy from Next. |
| 7 | **Save / list / reload / replay in UI** | Save button → POST compositions. List panel → GET list. Open saved → restore state, show saved report, optional “Replay” compose with same seed/state (planHash match check). |
| 8 | **JSON export bundle** | Client builds JSON (sandbox_state, hashes, report ref, export_id, timestamps); download. |
| 9 | **Wheel UX: sign-degree + house display, optional constraint** | Display sign° and house number per planet; optional “constrain to house” drag behavior. |
| 10 | **Phase 6 smoke** | Script: snapshot 200 → report 200 → compose 200 (with chartData) → export GET 200 → save → list → reload → re-compose same planHash. Additive to Phase 5. |

---

### One explicit walkthrough: “August 16, 1979, Sacramento, CA → 8 planets in Scorpio in 12th house → viz/text/audio → save/reload”

- **1. Set birth:** User enters date `1979-08-16`, time (e.g. `12:00`), location “Sacramento, CA”. App resolves to lat/lon (e.g. 38.5816, -121.4944) and sets `birth = { date: '1979-08-16', time: '12:00', lat: 38.5816, lon: -121.4944, tz: 'UTC', houseSystem: 'placidus' }`.
- **2. Load base chart:** App calls `POST /api/sandbox/snapshot` with `{ birth, overrides: { planets: {} } }`. Response: `snapshot` (planets, houses, aspects, etc.), `meta: { baseHash, overridesHash, combinedHash }`. Wheel shows ephemeris positions; user sees 12th house cusp range (e.g. 210°–240° if that’s how the chart falls for that birth).
- **3. Put 8 planets in Scorpio (and in 12th if cusps allow):** User drags or uses DegreePanel to set Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus (e.g. all to 220°) so `overrides.planets = { sun: { lonDeg: 220 }, moon: { lonDeg: 220 }, ... }`. Each change triggers debounced `POST /api/sandbox/snapshot` with `{ birth, overrides }`. `overriddenSnapshot` and `meta.combinedHash` update. Wheel shows all 8 in Scorpio; if 12th house for this birth spans 210–240°, they appear in house 12.
- **4. Generate triple output:** User clicks “Generate.”  
  - **Viz:** Already current (wheel from last snapshot).  
  - **Text:** `POST /api/sandbox/report` with `{ birth, overrides, seed: meta.combinedHash }` → report document (personality, guidance, explanation). Rendered in report panel.  
  - **Audio:** `POST /api/compose` with `{ mode: 'sandbox', chartData: { date: '1979-08-16', time: '12:00', lat: 38.5816, lon: -121.4944 }, controls: { ... }, seed: combinedHash }`. Compose uses **birth** only for architecture (no overrides); returns `plan_sha256`, `export_id`, `controls.hash`. Player URL = `/api/exports/${export_id}`; play/stop/replay/download.
- **5. Save:** User clicks “Save.” App sends `POST /api/sandbox/compositions` with body: `{ sandbox_state: { birth, overrides, controls }, vector_hash: combinedHash, seed: controls.hash, plan_hash: hashes.plan_sha256, report: <full report JSON>, provider, export_id }`. Backend returns `{ id, created_at }`.
- **6. List:** “My compositions” calls `GET /api/sandbox/compositions`; list includes the saved item (e.g. by created_at or id).
- **7. Reload:** User opens that item. App calls `GET /api/sandbox/compositions/:id`. Response includes `sandbox_state`, `report`. App restores `draft.birth`, `draft.overrides`, `draft.overriddenSnapshot` (or re-fetches snapshot from state), and displays the saved report. Wheel shows the same 8-in-Scorpio chart.
- **8. Replay:** User clicks “Replay.” App runs `POST /api/compose` with the same `chartData` (from saved birth), same `controls`, same `seed`. Response `hashes.plan_sha256` should match saved `plan_hash` (determinism). Optional: same `export_id` if cache hit, or new export_id with same audio hash.

**Concrete state and endpoints:**

- **Sandbox state (saved):**  
  `sandbox_state = { birth: { date: '1979-08-16', time: '12:00', lat: 38.5816, lon: -121.4944, tz: 'UTC', houseSystem: 'placidus' }, overrides: { planets: { sun: { lonDeg: 220 }, moon: { lonDeg: 220 }, mercury: { lonDeg: 220 }, venus: { lonDeg: 220 }, mars: { lonDeg: 220 }, jupiter: { lonDeg: 220 }, saturn: { lonDeg: 220 }, uranus: { lonDeg: 220 } } }, controls: { arc_shape: 0.5, density_level: 0.6, ... } }`
- **Calls:**  
  - Snapshot: `POST /api/sandbox/snapshot` body `{ birth, overrides }`.  
  - Report: `POST /api/sandbox/report` body `{ birth, overrides, seed: combinedHash }`.  
  - Compose: `POST /api/compose` body `{ mode: 'sandbox', chartData: { date: birth.date, time: birth.time, lat: birth.lat, lon: birth.lon }, controls, seed: combinedHash }`.  
  - Save: `POST /api/sandbox/compositions` with full record.  
  - Reload: `GET /api/sandbox/compositions/:id`.
