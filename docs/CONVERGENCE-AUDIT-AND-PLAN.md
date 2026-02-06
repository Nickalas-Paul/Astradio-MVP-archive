# Astradio Composition Pipeline: Convergence Audit and Plan

**Date:** 2026-02-05  
**Goal:** One canonical input → one canonical plan/spec → one canonical output; backend and frontend aligned; no divergent “local engine”; existing evaluation tooling preserved.

---

## A) Architecture Map (Repo-Wide)

### A.1) Codepaths that generate composition plan, music events, or audio

#### Backend

| Path | Entry point(s) | Input payload shape | Plan/spec produced | Renderer | Output to caller |
|------|----------------|---------------------|--------------------|----------|------------------|
| **vNext ComposeAPI** | `vnext/api/compose.ts` (class `ComposeAPI`, exported `vnextCompose`); mounted at `POST /api/compose` in `server/index.js` (line 1801) | `ComposeRequest`: `mode` (`sky` \| `overlay` \| `sandbox`), `skyParams` / `overlayParams` / `chartData`+`controls` per mode. Next proxy sends `mode: 'sky'`, `skyParams: { latitude, longitude, datetime }`. | **Plan:** from `generatePlanMLOnly(featureVec, payload)` → `vnext/plan-generator.ts` → `studentVector` (ML) → `planFromVector` (`vnext/planner/narrative.ts`) → `Plan`: `{ id, featureHash, durationSec, bpm, key, events: EventToken[] }`. **Not returned in response.** | When `ENABLE_WAV_EXPORT=1`: `vnext/audio/wav-renderer.ts` `renderWav60s(plan, payload, hash)` → 60s WAV. | `ComposeResponse`: `controls`, `gate_report`, `audio` (base64, sha256, …), `explanation`, `hashes`, `artifacts`, `telemetry`. **No `plan` field.** |
| **Chart snapshot** | `server/index.js` `GET /api/chart-snapshot` (1087–1126) | Query: `date`, `time`, `lat`, `lon`. | N/A (returns `EphemerisSnapshot`). | N/A | `EphemerisSnapshot` (planets, houses, aspects, moonPhase, dominantElements). |
| **Feature encoding** | `vnext/feature-encode.ts` `encodeFeatures(snapshot)` | `EphemerisSnapshot`. | N/A (returns 64-dim `FeatureVec`). | N/A | `FeatureVec` used by `generatePlanMLOnly`. |
| **Plan generation** | `vnext/plan-generator.ts` `generatePlanMLOnly(feat, chartContext)` | `FeatureVec` (64), optional `chartContext` (payload/hash). | `Plan` (events, bpm, key, durationSec). | N/A | Consumed by compose: gates → text → WAV. |
| **Audition gates** | `vnext/api/compose.ts` `runAuditionGates(plan, payload.hash)` (lines 393–424) | Plan + seed string. | N/A (scores and pass/fail). | N/A | `GateReport` in response. |
| **WAV renderer** | `vnext/audio/wav-renderer.ts` `renderWav60s(plan, payload, hash, options)` | Plan (with `events`, `bpm`, `key`), payload hash, options. | N/A (renders buffer). | Internal: 16-bit PCM from plan events (t0, t1, pitch, velocity). | `RenderResult`: buffer, sha256, duration_ms, size_bytes. |

#### Frontend

| Path | Entry point(s) | Input payload shape | Plan/spec produced | Renderer | Output to caller/UI |
|------|----------------|---------------------|--------------------|----------|---------------------|
| **Next compose proxy** | `apps/web/app/api/compose/route.ts` `POST` | Body: `{ date?, time?, location?, geo? }`. Validated by `ComposeSchema` (lines 6–14). | **No plan generated.** Converts to `mode: 'sky'`, `skyParams: { latitude, longitude, datetime }` and proxies to `API_BASE_URL`/`ENGINE_BASE_URL` (line 91–97). | None. | Proxied JSON from backend. |
| **Main page compose** | `apps/web/app/page.tsx` (useEffect ~90–194) | Same body (date, time, geo). Calls `fetch('/api/compose', { body: JSON.stringify(body) })`. | **No plan generated.** Uses response: `controls`, `explanation`, `audio` (base64 → blob URL). Sets `composeHash` from `payload.controls?.hash ?? payload.hash`. | When `audioUrl`: HTML5 `Audio(audioUrl)`. When no `audioUrl`: **Tone.js fallback** (lines 243–261). | UI state: chartData, explanationText, audioUrl, composeHash. |
| **Tone.js fallback** | `apps/web/app/page.tsx` `startPlanFallback()` (243–261) | Only `composeHash` (string). No backend plan. | **Local “plan”:** fixed 8-note loop: `Tone.Loop` every `8n`, pitch `48 + (i % 8) * 2` (MIDI). Not derived from backend plan. | Tone.js: `MembraneSynth`, `Tone.Loop`, `Tone.Transport`. | Audible playback only; no structural equality to backend plan. |
| **client-integration (unused)** | `vnext/client-integration.ts` `fetchVNextPlan`, `integrateVNextWithTone` | `chartContext`; calls `/api/vnext/compose` (line 22). | Expects `result.plan` from API. **Current API does not expose `/api/vnext/compose` or return `plan`.** | `planToToneEvents(plan)` from `vnext/scheduler.ts` (would convert Plan → Tone events). | Not used by `apps/web`; dead for current deployment. |
| **Sandbox / Compatibility** | `apps/web/app/sandbox/page.tsx`, `apps/web/src/components/CompatibilitySection.tsx` | POST `/api/compose` with mode-specific bodies. | None locally; display backend response. | No local audio generation. | UI only. |

#### Dead / duplicate code

| Item | Location | Role | Duplication / risk |
|------|----------|------|--------------------|
| **makeSnapshot, hnum, PLANETS** | `apps/web/app/api/compose/route.ts` 22–39 | Hash-based positions/houses. **Never called.** | September-era “audio engine” remnant; could confuse; safe to remove. |
| **client-integration** | `vnext/client-integration.ts` | Fetches “vNext plan” from `/api/vnext/compose`, expects `result.plan`. | API does not have that route or field; frontend never imports this; duplicate concept (plan fetch + Tone render) that was never wired. |
| **scheduler.ts planToToneEvents** | `vnext/scheduler.ts` | Converts `Plan` → Tone.js-style events. | Used by client-integration and by WAV renderer’s event iteration; single implementation, but only backend and unused client-integration use it; frontend fallback does not. |

### A.2) Repo map table

| Component | Files | Role | Owner |
|-----------|-------|------|--------|
| Compose API (engine) | `vnext/api/compose.ts`, `server/index.js` (mount) | Request → payload → snapshot → features → ML → plan → gates → text → WAV → response | Backend |
| Chart snapshot | `server/index.js` GET /api/chart-snapshot | EphemerisSnapshot for feature encoding | Backend |
| Feature encoder | `vnext/feature-encode.ts` | EphemerisSnapshot → FeatureVec(64) | Backend (vnext) |
| Plan generator | `vnext/plan-generator.ts`, `vnext/planner/narrative.ts`, `vnext/ml` (studentVector) | FeatureVec + context → Plan | Backend (vnext) |
| Audition gates | `vnext/api/compose.ts` (runAuditionGates), `vnext/audition-gate.ts` | Plan + seed → GateReport | Backend (vnext) |
| WAV renderer | `vnext/audio/wav-renderer.ts` | Plan + hash → 60s WAV buffer | Backend (vnext) |
| Text explainer | `vnext/explainer/*`, `vnext/explainer/mapping-tables-v1.json` | Payload + gateReport → explanation | Backend (vnext) |
| Next compose proxy | `apps/web/app/api/compose/route.ts` | Validate body → sky request → proxy to engine | Frontend (Next API route) |
| Main page compose + play | `apps/web/app/page.tsx` | Fetch /api/compose → set state → play WAV or Tone fallback | Frontend |
| Tone.js fallback | `apps/web/app/page.tsx` (startPlanFallback) | Hash-only 8-note loop; no backend plan | Frontend |
| client-integration | `vnext/client-integration.ts`, `vnext/scheduler.ts` | Intended: fetch plan → Tone events; **unused** | Shared (vnext) but not used by app |
| Plan → Tone events | `vnext/scheduler.ts` `planToToneEvents` | Plan → Tone-compatible event list | Shared (vnext) |

### A.3) Divergence list

| Divergence | Risk | Fix |
|------------|------|-----|
| Backend produces a full Plan (events, bpm, key) but does not return it. | Frontend cannot “play the same plan” when WAV is disabled; fallback is a different composition. | Include `plan` (or a stable plan representation) in ComposeResponse when fallback playback is desired; or always require WAV and remove fallback. |
| Tone.js fallback uses only `composeHash` and a fixed 8-note pattern. | Users hear a different piece than the one golden/soak tests validate (WAV from real plan). | Make fallback consume backend-returned plan and render via Tone.js (e.g. planToToneEvents); or remove fallback and require WAV. |
| Next route contains dead makeSnapshot/hnum/PLANETS. | Confusion; potential future misuse. | Remove dead code in a small PR. |
| client-integration calls non-existent `/api/vnext/compose` and expects `result.plan`. | Dead code; misleading for future readers. | Remove or rewrite to use `/api/compose` and optional `plan` in response. |

---

## B) What the current tests actually exercise

### B.1) test:compose-golden-run

- **Script:** `vnext/scripts/compose-golden-run.ts` (run via `npm run test:compose-golden-run` → `vnext:build` then `node dist/vnext/vnext/scripts/compose-golden-run.js`).
- **Endpoint:** `POST ${ASTRADIO_BASE_URL}/api/compose` (line 218). **Required env:** `ASTRADIO_BASE_URL` (e.g. `https://astradio-mvp-archive.onrender.com`). No local server; hits **live** backend.
- **Request body:** Each case from `vnext/eval/golden-set.json`: array of `{ id, name, body }`. Bodies include:
  - **Sandbox:** `mode: "sandbox"`, `chartData: { date, time, lat, lon }`, `controls: { arc_shape, density_level, ... }`.
  - **Sky:** `mode: "sky"`, `skyParams: { latitude, longitude, datetime }`.
  - **Overlay:** `mode: "overlay"`, `overlayParams: { natalLatitude, natalLongitude, natalDatetime, currentLatitude, currentLongitude, currentDatetime }`.
- **Backend path:** Real backend (Render): receives body → `generateControlPayload` → `fetchChartSnapshot` (same host `/api/chart-snapshot`) → real ephemeris → `encodeFeatures` → `generatePlanMLOnly` (real ML when available) → plan → gates → text → WAV (if `ENABLE_WAV_EXPORT=1`). So plan is created from **real ephemeris + features + ML** on the deployed server (no mocks in golden run).
- **Audio produced:** On Render, when `ENABLE_WAV_EXPORT=1`, WAV is produced by `vnext/audio/wav-renderer.ts` from the same plan used for gates/text.
- **Assertions:** HTTP 200, `audio_export_available`, `audio_size_bytes`, `audio_sha256`, `wav_valid` (RIFF/WAVE header check, lines 64–73), telemetry fields; optional diff vs `vnext/eval/baseline/results.json` (audio sha, wav_valid, http_status, etc.). Writes run to `vnext/eval/runs/<timestamp>_<gitsha>/results.json` and `report.md`.

### B.2) test:compose-golden-baseline

- **Script:** `scripts/golden-baseline.js` sets `GOLDEN_UPDATE_BASELINE=1` and requires `dist/vnext/vnext/scripts/compose-golden-run.js`. So it runs the **same** golden runner; when `GOLDEN_UPDATE_BASELINE=1`, the runner writes the current run’s payload to `vnext/eval/baseline/results.json` (compose-golden-run.ts 309–311).

### B.3) test:compose-soak (determinism soak)

- **Script:** `vnext/scripts/compose-determinism-soak.ts`. **In-process:** instantiates `ComposeAPI`, mocks `global.fetch` so that URLs containing `chart-snapshot` return a fixed `EphemerisSnapshot`; no network. Request: fixed sandbox body (date 2025-01-15, time 12:00, NY coords, fixed controls). Runs N times (default 20), delay 250 ms. Sets `ENABLE_WAV_EXPORT=1`. Asserts: all responses have same `audio.sha256`, `gate_report.calibrated.overall === true`, response has `audio.format`, `audio.base64`, `audio.sha256`.

### B.4) test:compose-live-soak

- **Script:** `vnext/scripts/compose-live-soak.ts`. **Live HTTP:** `POST ${ASTRADIO_BASE_URL}/api/compose` with a fixed deterministic body, N times (default 20), delay 750 ms. Optional `X-Soak-Token` when `SOAK_TOKEN` set (bypass rate limit). Asserts: 200, `audio.sha256` present, `gate_report.calibrated.overall` true, all sha256 identical. Preflight checks health and one compose; fails if audio export disabled.

### B.5) Soak token bypass

- **Where:** `server/index.js`: compose rate limiter and/or global limiter skip when `soakBypassAllowed(req)` (e.g. `SOAK_BYPASS_ENABLED=1`, staging env, `X-Soak-Token` matches `SOAK_BYPASS_TOKEN`). Used so golden and live soak can run without 429s. See `docs/RUNBOOK.md`, `soak-only-repo/evidence/*`.

### B.6) Definitive answers

- **Do golden runs validate the same plan that users will hear in the frontend today?**  
  **Only when WAV is used.** Golden runs validate the **backend** response: same request → same WAV (and gate pass). When the frontend has `audio.base64` (or URL), it plays that WAV, which is generated from the backend plan. So in that case, users hear the same plan that golden/soak validate.  
  **When WAV is not returned** (e.g. staging without `ENABLE_WAV_EXPORT=1`), the frontend uses the Tone.js fallback, which **does not** use the backend plan; it plays a fixed 8-note loop derived only from `composeHash`. So in that case, golden runs do **not** validate what the user hears.

- **What is missing?**  
  1) The API does not return `plan` (or a plan hash), so the frontend cannot render “the same plan” in Tone.js when WAV is absent.  
  2) No E2E test that loads the UI, triggers compose, and asserts that played audio (or the structure used for playback) matches the backend plan or WAV hash.

---

## C) Single Source of Truth contract

### C.1) Canonical CompositionPlan schema

Use the existing `Plan` type from `vnext/contracts.ts` (lines 27–35) as the canonical plan:

```ts
// vnext/contracts.ts (existing)
export type EventToken = {
  t0: number; t1: number; pitch: number; velocity: number;
  channel: 'melody' | 'harmony' | 'rhythm' | 'bass'; group?: string;
};
export type Plan = {
  id: string; featureHash: string; durationSec: number; bpm: number; key: string;
  events: EventToken[];
};
```

**Canonical name for the contract:** `CompositionPlan` can be an alias for `Plan` in the shared contract so both backend and frontend refer to the same type.

### C.2) Canonical ComposeResponse schema

Extend the existing `ComposeResponse` in `vnext/explainer/contracts.ts` (and the actual response in `vnext/api/compose.ts`) to optionally include the plan:

- **Current:** `controls`, `astro`, `gate_report`, `audio`, `text`, `explanation`, `viz`, `hashes`, `artifacts`, `telemetry`, `audio_export_available`.
- **Add (optional):** `plan?: CompositionPlan` or `plan_hash?: string` (if you want to avoid sending full events in every response). Recommendation: add `plan` when `audio_export_available === false` (or behind a query/flag) so the frontend can drive Tone.js from it when WAV is disabled.

### C.3) Where the contract should live and how to import

- **Location:** Keep and extend **`vnext/contracts.ts`** for `Plan` / `EventToken`; keep **`vnext/explainer/contracts.ts`** for `ComposeRequest`, `ComposeResponse`, `ControlSurfacePayload`, `GateReport`. If desired, add a small **`vnext/contracts/compose-api.ts`** (or `packages/contracts/`) that re-exports both and defines `CompositionPlan = Plan` and the extended `ComposeResponse` so a single import path is the source of truth.
- **Backend:** Already imports from `vnext/contracts` and `vnext/explainer/contracts`; add the optional `plan` to the response object in `vnext/api/compose.ts`.
- **Frontend:** Add a dependency on the shared contract: either (1) import from `vnext/contracts` and `vnext/explainer/contracts` via workspace/relative path (e.g. `@repo/vnext-contracts` or `../../vnext/contracts` from apps/web), or (2) publish a minimal `astradio-contracts` package. Ensure no circular deps: vnext should not import from apps/web; apps/web may import from vnext only types/contracts and scheduler (planToToneEvents). Current repo has no such package; the minimal change is to have apps/web import from `vnext/contracts` and `vnext/scheduler` (or a thin client bundle that exposes plan types + planToToneEvents).

### C.4) Versioning strategy

- **Schema version in response:** Add `artifacts.schema_version: '1.1'` (or similar); when adding `plan`, bump to `1.2` and document that `plan` is optional and may be omitted when WAV is returned.
- **Backwards compatibility:** New optional fields only (`plan`, `plan_hash`). Existing clients ignore them. Golden and soak tests do not need to assert on `plan` unless you add a new test that checks structural equality or plan hash.

---

## D) Convergence design (two options)

### Option 1: API-first (recommended)

- **Idea:** Frontend always calls `/api/compose`. It never generates a plan locally. When the response includes WAV, play it. When it does not (e.g. staging), response includes `plan`; frontend uses that plan to drive Tone.js (same events as the backend would use for WAV), so playback is structurally the same as the backend plan.
- **Backend:** Add optional `plan` to the compose response (e.g. when `audio_export_available === false`, or always with a feature flag). No change to how plan is produced (still snapshot → features → ML → plan → WAV).
- **Frontend:** Remove the hash-only 8-note fallback. When there is no WAV, if `payload.plan` exists, run `planToToneEvents(payload.plan)` (or equivalent) and schedule those events with Tone.js; otherwise show “audio unavailable” or keep a minimal beep for a11y.
- **Files to change (order):**
  1. **vnext/contracts.ts** – Ensure `Plan` / `EventToken` are exported and stable (already are).
  2. **vnext/explainer/contracts.ts** – Add optional `plan?: Plan` to `ComposeResponse` type (or in a separate compose-api contract file).
  3. **vnext/api/compose.ts** – In the response object, add `plan: plan` when `!audio_export_available` (or when a flag is set), and ensure `plan` is JSON-serializable (no functions). Omit or redact if you prefer not to send full plan when WAV is present.
  4. **vnext/scheduler.ts** – Ensure `planToToneEvents` is exportable and works in browser (no Node-only deps). Already pure; may need to be callable from apps/web (e.g. via a small adapter in apps/web that imports from vnext).
  5. **apps/web/app/page.tsx** – In the compose effect, store `payload.plan` in state if present. In `startPlanFallback`, if `plan` exists, use it: convert to Tone events (import from vnext or a shared bundle) and schedule with Tone.js; if no plan, do not play or play a short “unavailable” tone. Remove the fixed `48 + (i % 8) * 2` loop.
  6. **apps/web/app/api/compose/route.ts** – Remove dead `makeSnapshot`, `hnum`, `PLANETS` (optional, small PR).
- **Golden tests:** Unchanged. They already POST to `/api/compose` and assert on 200, audio sha, wav_valid. Adding `plan` to the response does not break them. Optionally add a golden case that asserts `plan` shape when `audio_export_available === false`.
- **New tests:** (1) E2E (or integration): call `/api/compose` with a fixed body, assert response has `plan` when WAV is disabled, and that `plan.events.length > 0`, `plan.bpm`, `plan.key`. (2) E2E: load UI, run compose, get response with plan, trigger play with fallback, assert no error and (if feasible) that the number of scheduled events matches `plan.events.length`.

### Option 2: Shared-core

- **Idea:** Extract plan generation (and optionally mapping rules) into a shared package used by both backend and frontend. Backend still owns WAV export; frontend owns interactive Tone.js playback; both use the same plan-generation code path (same features → same plan) so that “same input → same plan” is guaranteed by construction. Frontend would need either (a) to call the backend for chart-snapshot + features + ML (complex, duplicates network and ML dependency) or (b) to run a “plan-only” endpoint that returns plan from backend and frontend only renders it—which reduces to Option 1 for the data flow, with the only difference being that the “shared” code is the narrative/planner and feature-encode in a package consumed by both. That is a larger refactor.
- **Files to change:** Create a shared package (e.g. `packages/compose-core`) containing `feature-encode`, `plan-generator`, `planner/narrative`, `contracts`. Backend and (if ever needed) a hypothetical client-side “plan” path would both import from this package. Frontend would still get the plan from the API (recommended) or, in a more complex variant, run feature-encode + ML in worker (heavy). So in practice, “shared-core” still implies returning the plan from the API for the frontend to render; the main extra work is moving vnext modules into a shared package and fixing imports.
- **Golden tests:** Unchanged; backend still serves `/api/compose` the same way.
- **New tests:** Same as Option 1; plus any unit tests for the extracted shared package.

**Recommendation:** **Option 1 (API-first).** Minimal surface: add `plan` to the response and make the frontend Tone.js fallback consume it. No new package or ML on the client; same golden/soak harness; clear single source of truth (backend produces plan, frontend only renders it).

---

## E) Tightening plan (phases)

### Phase 0: Audit & safety

- **0.1** Add non-invasive logging/telemetry that confirms “frontend consumed backend plan” when fallback is used: e.g. in `page.tsx`, when playing from `payload.plan`, log a single line (or send a non-PII metric) such as `astradio:playback_source=plan_fallback`, `plan_events_count=N`. Do not log full plan or PII.
- **0.2** Add a feature flag (e.g. `USE_BACKEND_PLAN_FALLBACK` or in `apps/web` config/flags) so that when **off**, behavior is unchanged (current hash-only fallback); when **on**, use backend plan when present. Default **off** until Phase 1 is verified.
- **Files:** `apps/web/app/page.tsx`, optionally `apps/web/src/core/config/flags.ts` or env.

### Phase 1: Plan alignment

- **1.1** Define canonical `CompositionPlan` (alias for `Plan`) and extend `ComposeResponse` with optional `plan` in `vnext/explainer/contracts.ts` (or shared contract file).
- **1.2** In `vnext/api/compose.ts`, add `plan` to the response when `!audio_export_available` (or when a server flag is set). Ensure `plan` is plain JSON (e.g. strip any non-serializable fields).
- **1.3** Frontend: in the compose effect, store `payload.plan` in state. In `startPlanFallback`, when flag is on and `plan` exists, convert plan to Tone events (use `vnext/scheduler.ts` `planToToneEvents` via an adapter or shared import) and schedule with Tone.js; when flag is off or no plan, keep current hash-only fallback.
- **1.4** Remove dead code in `apps/web/app/api/compose/route.ts` (makeSnapshot, hnum, PLANETS) in a separate small PR.
- **Files:** `vnext/contracts.ts`, `vnext/explainer/contracts.ts`, `vnext/api/compose.ts`, `apps/web/app/page.tsx`, `apps/web/app/api/compose/route.ts`.

### Phase 2: Remove divergence

- **2.1** Switch default of `USE_BACKEND_PLAN_FALLBACK` to **on** (or remove flag and always use backend plan when present).
- **2.2** When `plan` is missing and WAV is missing, do not run the old hash-only loop; either show “Audio unavailable” or play a single short “unavailable” tone. Remove the fixed 8-note loop code.
- **2.3** Optionally remove or deprecate `vnext/client-integration.ts`’s fetch of `/api/vnext/compose` (or rewrite it to call `/api/compose` and use `result.plan`), so there is no second “plan source” in the codebase.
- **Files:** `apps/web/app/page.tsx`, `vnext/client-integration.ts`.

### Phase 3: End-to-end proof

- **3.1** Add an E2E (or integration) test that: (1) POSTs a fixed request to `/api/compose` (or to the app’s `/api/compose` proxy), (2) asserts response has deterministic `plan` hash (e.g. hash of `JSON.stringify(plan.events)` or similar) and, when WAV is enabled, same `audio.sha256` as baseline, (3) (if possible) loads the UI with that response, triggers play in fallback mode, and asserts that the scheduled Tone.js events count (or a structural hash) matches the plan. Prefer small assertions (e.g. plan hash + audio sha) to avoid flakiness.
- **Files:** New test file in `apps/web/e2e` or `vnext/eval` (e.g. `vnext/eval/e2e-compose-plan-sync.ts` or Playwright in apps/web).

---

## F) Step-by-step checklist (PR-sized)

1. **Phase 0.1** – Add telemetry when fallback uses backend plan (flag off, no behavior change).
2. **Phase 0.2** – Add feature flag `USE_BACKEND_PLAN_FALLBACK`, default off.
3. **Phase 1.1** – Extend ComposeResponse type with optional `plan`; document in contracts.
4. **Phase 1.2** – Backend: set `response.plan` when `!audio_export_available` (or behind flag).
5. **Phase 1.3** – Frontend: when flag on and `payload.plan` present, use planToToneEvents + Tone.js in fallback; else keep current fallback.
6. **Phase 1.4** – Remove dead makeSnapshot/hnum/PLANETS from Next compose route.
7. **Phase 2.1** – Default flag to on (or remove flag).
8. **Phase 2.2** – Remove hash-only 8-note fallback; “no plan + no WAV” → unavailable message or minimal tone.
9. **Phase 2.3** – Remove or rewrite client-integration so it does not assume `/api/vnext/compose` or missing `plan`.
10. **Phase 3.1** – Add E2E/integration test: fixed POST → assert plan hash (and audio sha when WAV on); optionally UI play → assert structure matches plan.

---

## Do not break

- **Golden run:** `npm run test:compose-golden-run` – Keep hitting `ASTRADIO_BASE_URL/api/compose` with bodies from `vnext/eval/golden-set.json`; do not change request shape or required env; keep writing to `vnext/eval/runs/<timestamp>_<gitsha>/` and optional baseline at `vnext/eval/baseline/results.json`.
- **Golden baseline:** `npm run test:compose-golden-baseline` – Keep `GOLDEN_UPDATE_BASELINE=1` + same runner; baseline path `vnext/eval/baseline/results.json`.
- **Soak determinism:** `npm run test:compose-soak` – In-process ComposeAPI + mocked chart-snapshot; `ENABLE_WAV_EXPORT=1`; assert identical audio.sha256 and gate pass. Do not remove or change the mock fetch for `chart-snapshot`.
- **Live soak:** `npm run test:compose-live-soak` – `ASTRADIO_BASE_URL` required; fixed body; assert 200, audio.sha256, gate pass, identical sha256 across runs. Keep optional `SOAK_TOKEN` / `X-Soak-Token` for rate-limit bypass.
- **Env vars:** Do not remove or rename: `ASTRADIO_BASE_URL`, `SOAK_TOKEN`, `GOLDEN_UPDATE_BASELINE`, `ENABLE_WAV_EXPORT`, `API_BASE_URL` / `ENGINE_BASE_URL` (Next proxy), `SOAK_BYPASS_ENABLED` / `SOAK_BYPASS_TOKEN` (Render), `ALLOW_ML_SKIP` (tests). Document any new vars (e.g. `USE_BACKEND_PLAN_FALLBACK`) in RUNBOOK or env.example.
- **Render:** Keep `/api/compose`, `/api/chart-snapshot`, `/health` behavior and response shape; WAV export remains gated by `ENABLE_WAV_EXPORT=1`; rate limiter and soak bypass logic unchanged unless explicitly part of a separate change.
- **Build:** `npm run vnext:build` must still produce `dist/vnext/vnext/...` so golden and soak scripts can run; no breaking changes to ComposeAPI’s public method `compose(request)`.

---

## F) Output format (required deliverables)

### F.1) Executive summary

**What’s wrong**
- **Two effective “engines”:** (1) Backend vNext: chart snapshot → feature encoding → ML → plan → WAV renderer; (2) Frontend: when WAV is absent (e.g. staging), a **Tone.js fallback** plays a fixed 8-note loop seeded only by `composeHash`—it does **not** use the backend’s plan. The backend never returns `plan` in the response, so the UI cannot “render the backend plan” in the fallback path.
- **Legacy/unused code:** Next.js compose route contains dead `makeSnapshot`/`hnum`/`PLANETS` (September-era style); `vnext/client-integration.ts` expects `/api/vnext/compose` and `result.plan`, which the current API does not provide.
- **Golden runs validate backend only:** They assert HTTP 200, `audio.sha256`, `wav_valid`, and gate pass for the live `/api/compose` endpoint. They do **not** assert that the frontend plays the same plan when WAV is disabled; in that case the frontend plays a different (hash-based) loop.

**What will fix it**
- **Single source of truth:** Canonical **CompositionPlan** and **ComposeResponse** (optional `plan`) in shared contract; backend returns plan when fallback playback is needed.
- **API-first convergence (recommended):** Frontend always calls `/api/compose`; when WAV is absent, use **backend-returned plan** to drive Tone.js (same events as WAV), not the local hash-based loop; remove or gate the divergent fallback.
- **Phased rollout:** Telemetry + feature flag → add plan to response → frontend renders backend plan in fallback → remove divergent fallback → E2E test for same-plan playback.

### F.2) Repo map table (Component → Files → Role → Owner)

| Component | Files | Role | Owner |
|-----------|-------|------|--------|
| Compose API (engine) | `vnext/api/compose.ts`, `server/index.js` | Request → payload → snapshot → features → ML → plan → gates → text → WAV → response | Backend |
| Chart snapshot | `server/index.js` GET /api/chart-snapshot | EphemerisSnapshot for feature encoding | Backend |
| Feature encoder | `vnext/feature-encode.ts` | EphemerisSnapshot → FeatureVec(64) | Backend (vnext) |
| Plan generator | `vnext/plan-generator.ts`, `vnext/planner/narrative.ts`, `vnext/ml` | FeatureVec + context → Plan | Backend (vnext) |
| Audition gates | `vnext/api/compose.ts`, `vnext/audition-gate.ts` | Plan + seed → GateReport | Backend (vnext) |
| WAV renderer | `vnext/audio/wav-renderer.ts` | Plan + hash → 60s WAV buffer | Backend (vnext) |
| Text explainer | `vnext/explainer/*`, `mapping-tables-v1.json` | Payload + gateReport → explanation | Backend (vnext) |
| Next compose proxy | `apps/web/app/api/compose/route.ts` | Validate → sky request → proxy to engine | Frontend |
| Main page compose + play | `apps/web/app/page.tsx` | Fetch /api/compose → state → play WAV or Tone fallback | Frontend |
| Tone.js fallback | `apps/web/app/page.tsx` startPlanFallback | Hash-only 8-note loop (no backend plan) | Frontend |
| client-integration | `vnext/client-integration.ts`, `vnext/scheduler.ts` | Intended: fetch plan → Tone events; **unused** | Shared (unused) |

### F.3) Divergence list (Divergence → Risk → Fix)

| Divergence | Risk | Fix |
|------------|------|-----|
| Backend produces Plan but does not return it | Frontend cannot play same plan when WAV disabled; fallback is different composition | Add optional `plan` to ComposeResponse when fallback desired |
| Tone.js fallback uses only composeHash + fixed 8-note pattern | Users hear different piece than golden/soak validate (WAV from real plan) | Fallback consumes backend-returned plan and planToToneEvents |
| Dead makeSnapshot/hnum/PLANETS in Next route | Confusion; potential misuse | Remove in small PR |
| client-integration calls /api/vnext/compose, expects result.plan | Dead code; misleading | Remove or rewrite to use /api/compose + plan |

### F.4) Step-by-step checklist (PR-by-PR)

1. **Phase 0.1** – Add telemetry when fallback uses backend plan (flag off).
2. **Phase 0.2** – Add feature flag `USE_BACKEND_PLAN_FALLBACK`, default off.
3. **Phase 1.1** – Extend ComposeResponse with optional `plan` in contracts.
4. **Phase 1.2** – Backend: set `response.plan` when `!audio_export_available` (or behind flag).
5. **Phase 1.3** – Frontend: when flag on and `payload.plan` present, use planToToneEvents + Tone.js in fallback.
6. **Phase 1.4** – Remove dead makeSnapshot/hnum/PLANETS from Next compose route.
7. **Phase 2.1** – Default flag to on (or remove flag).
8. **Phase 2.2** – Remove hash-only 8-note fallback; “no plan + no WAV” → unavailable or minimal tone.
9. **Phase 2.3** – Remove or rewrite client-integration.
10. **Phase 3.1** – Add E2E test: fixed POST → plan hash + audio sha; optionally UI play → structure matches plan.

### F.5) Do not break (explicit list)

- **Golden run:** `npm run test:compose-golden-run` – `ASTRADIO_BASE_URL/api/compose`, bodies from `vnext/eval/golden-set.json`, output under `vnext/eval/runs/`, baseline `vnext/eval/baseline/results.json`.
- **Golden baseline:** `npm run test:compose-golden-baseline` – same runner with `GOLDEN_UPDATE_BASELINE=1`.
- **Soak determinism:** `npm run test:compose-soak` – in-process ComposeAPI, mocked chart-snapshot, `ENABLE_WAV_EXPORT=1`, identical audio.sha256 and gate pass.
- **Live soak:** `npm run test:compose-live-soak` – `ASTRADIO_BASE_URL`, fixed body, `SOAK_TOKEN` optional, assert 200 and identical audio.sha256.
- **Env vars:** `ASTRADIO_BASE_URL`, `SOAK_TOKEN`, `GOLDEN_UPDATE_BASELINE`, `ENABLE_WAV_EXPORT`, `API_BASE_URL`/`ENGINE_BASE_URL`, `SOAK_BYPASS_ENABLED`/`SOAK_BYPASS_TOKEN`, `ALLOW_ML_SKIP`.
- **Render:** `/api/compose`, `/api/chart-snapshot`, `/health`; WAV gated by `ENABLE_WAV_EXPORT=1`; rate limiter and soak bypass unchanged unless intentional.
- **Build:** `npm run vnext:build` → `dist/vnext/vnext/...`; ComposeAPI `compose(request)` contract unchanged.

---

*End of convergence audit and plan.*
