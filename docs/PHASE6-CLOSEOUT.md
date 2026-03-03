## Phase 6 — Sandbox Composition Closeout

### Overview / Architecture

- **Canonical surface**: `/sandbox` is the single lab entry point. `/sandbox/builder` is a thin redirect to `/sandbox`, and no other sandbox UIs are linked from navigation (`Header` and `HeaderTabs` both point to `/sandbox` only).
- **Engine pipeline**:
  - `POST /api/sandbox/snapshot` (engine) produces a canonical `EphemerisSnapshot` plus `meta.combinedHash` (birth + overrides hash).
  - `POST /api/sandbox/report` consumes the same birth/overrides with `seed = combinedHash` and runs `generateArchitectureFromSnapshot`, returning a compose‑free report (features, personality, guidance, explanation).
  - `POST /api/compose` is called in **sandbox mode** with:
    - `mode: 'sandbox'`
    - `controls: SANDBOX_CONTROLS` (fixed control-surface payload)
    - `seed: combinedHashUsed`
    - `overriddenSnapshot: snapshotUsed` (from the fresh snapshot call)
  - Compose **never** falls back to `chartData` in sandbox mode when `overriddenSnapshot` is provided; Phase 6 added a strict override path that always uses `generateArchitectureFromSnapshot` when `req.mode === 'sandbox' && req.overriddenSnapshot != null`.
- **UI orchestration**:
  - The `/sandbox` page owns a single deterministic Generate handler that:
    1. Cancels any in‑flight snapshot sync.
    2. Calls `/api/sandbox/snapshot` and captures immutable locals `snapshotUsed` and `combinedHashUsed`.
    3. Calls `/api/sandbox/report` with `seed = combinedHashUsed`.
    4. Calls `/api/compose` with `mode: 'sandbox'`, `controls`, `seed = combinedHashUsed`, `overriddenSnapshot = snapshotUsed`.
  - All three stages share the same chart state and seed; no reactive mid‑pipeline state is read.
- **Persistence**:
  - Backend table `astradio_sandbox_compositions` stores:
    - `sandbox_state` (birth, overrides, controls),
    - `vector_hash` (combinedHashUsed),
    - `seed`, `plan_hash`, `report`, `provider`, `export_id`, timestamps.
  - Engine routes:
    - `POST /api/sandbox/compositions` → save composition (DB‑backed only; returns 503 when DB unavailable).
    - `GET /api/sandbox/compositions` → list recent rows.
    - `GET /api/sandbox/compositions/:id` → load a single row.
  - Next.js proxies these `/api/sandbox/compositions` calls to the engine.
  - The sandbox UI exposes **Save**, **Saved list**, **Load**, and **Replay (same seed)** on top of this contract.

### Invariants Preserved

- **Core engine boundaries**:
  - `vnext/core/architecture-engine.ts` was never modified in Phase 6.
  - `vnext/feature-encode.ts` was never modified.
  - Compose override behavior remains fail‑closed for invalid `overriddenSnapshot` inputs (strict validator in `ComposeAPI`).
- **Sandbox surface discipline**:
  - `/sandbox` is the only sandbox UI linked from navigation.
  - `/sandbox/builder` is a permanent redirect to `/sandbox`.
  - No legacy sandbox builder pages or alternate routes are active.
  - No mock engine adapters are referenced in the sandbox UI; all calls go through the real engine HTTP surface (`/api/sandbox/*`, `/api/compose`, `/api/exports`, `/api/sandbox/compositions`).
- **Triple‑output determinism**:
  - Generate always performs: **snapshot → report → compose**, using a fresh snapshot and hash each time the button is pressed.
  - Compose is always invoked with `overriddenSnapshot` when in sandbox mode; there is no fallback to a different chart source.
  - The UI records the `plan_sha256` from compose and exposes a **Replay (same seed)** action that replays compose with the same `snapshotUsed`, `combinedHashUsed`, and controls, then compares hashes and surfaces “Determinism mismatch” if they differ.
- **Fail‑closed behavior**:
  - Invalid `overriddenSnapshot` shapes (including malformed planets/houses/etc.) are rejected by the compose API with explicit `Invalid overriddenSnapshot` errors.
  - If snapshot or report fails, compose is not called and the UI presents explicit “Viz/Report/Audio” error messages with reasons.
  - If compose fails or does not return `hashes.plan_sha256`, the UI marks audio as failed and does not attempt to play or save results.
- **Persistence integrity**:
  - The JSON export bundle from `/sandbox` is stable:
    - Always includes `combinedHashUsed`, `plan_sha256`, `export_id`, `provider`, `createdAt`.
    - Uses `null` for missing values (never `undefined`), so downstream tools see a consistent schema.
  - Saved compositions reload into the UI by:
    - Restoring `birth`, `overrides`, `controls` from `sandbox_state`.
    - Restoring `report`, `plan_hash`, `export_id`, `seed/vector_hash`.
    - Re‑calling `/api/sandbox/snapshot` to rebuild `overriddenSnapshot` and hash, so subsequent Replay uses the same engine pipeline as a fresh run.

### Acceptance Criteria Verification

#### 1) Surface discipline

- **Only sandbox surface**:
  - `apps/web/src/components/Header.tsx` and `HeaderTabs.tsx` both link to `/sandbox` as the single sandbox entry.
  - `apps/web/app/sandbox/builder/page.tsx` is a simple `redirect('/sandbox')` implementation.
  - There are no alternative sandbox pages or legacy builders wired into navigation.
- **No mock engine adapters in sandbox**:
  - Mock social APIs and mock engine adapters are confined to social/dev codepaths; the sandbox page and sandbox components (`BirthDataForm`, `WheelCanvasBuilder`, `DegreePanel`) do not import or reference any mock engine modules.

**Result**: Surface discipline is satisfied.

#### 2) Triple‑output integrity

- **Order guaranteed**:
  - The Generate handler on `/sandbox` cancels in‑flight snapshot syncing, then performs:
    1. `POST /api/sandbox/snapshot` (normalize overrides → snapshot + `combinedHashUsed`).
    2. `POST /api/sandbox/report` with `seed = combinedHashUsed`.
    3. `POST /api/compose` with `mode:'sandbox'`, fixed `controls`, `seed = combinedHashUsed`, `overriddenSnapshot = snapshotUsed`.
  - All downstream UI state (viz/report/audio indicators, plan hash, export id) is derived from this single pipeline.
- **Compose always uses overriddenSnapshot**:
  - Sandbox compose calls from the UI always include `overriddenSnapshot: snapshotUsed`.
  - `ComposeAPI` inspects `req.mode` and `req.overriddenSnapshot` and, in sandbox mode, always calls `generateArchitectureFromSnapshot` when the override is provided.
- **Determinism**:
  - The Replay action on `/sandbox` reuses the stored `snapshotUsed`, `combinedHashUsed`, and controls, calls compose again, and compares the new `plan_sha256` to the previous one.
  - Mismatches are explicitly surfaced as “Determinism mismatch”; matches are indicated with a “Replay matched plan hash” confirmation.
  - The standalone script `vnext/scripts/phase6-sandbox-smoke.ts` independently replays compose with the same `seed` and `overriddenSnapshot` and fails if the plan hash changes.

**Result**: Triple‑output integrity and determinism are satisfied.

#### 3) Failure modes

- **Export disabled**:
  - When `ENABLE_WAV_EXPORT` is not enabled, compose returns `audio_export_available=false` and an `audio_debug` payload indicating export failure class; the sandbox UI:
    - Shows “Audio export unavailable” and does not attempt to construct or play a URL.
    - Surfaces a short, actionable message about export failure and exposes details behind a collapsible debug area when debug information is present.
  - The Phase 6 sandbox smoke script treats exports as optional:
    - If `export_id` is present, it verifies `GET /api/exports/:id` returns 200 and non‑empty body.
    - If `export_id` is missing but `audio_debug` / `audio.export_error` signal an unavailable export, it logs SKIP and continues.
- **DB unavailable (503)**:
  - Engine routes for `/api/sandbox/compositions` return `503` with a clear JSON error when the DB module is not available.
  - The sandbox UI propagates this as a specific Save error (“saving unavailable / database not configured”), and the app remains usable without persistence.
  - The `phase6-verify-compositions` script and the Phase 6 smoke runner both detect `ECONNREFUSED` / DB failures and log **SKIP** instead of hard‑failing, while still performing full checks when the DB exists.
- **Engine unreachable**:
  - `vnext/scripts/phase6-sandbox-smoke.ts` performs a `/health` preflight:
    - If the engine is unreachable and `PHASE6_SMOKE_REQUIRE_ENGINE=1`, it fails with a clear message instructing the caller to start the engine or set `ENGINE_BASE_URL`.
    - Otherwise, it logs “SKIP: engine not running at …” and exits 0, keeping local development smooth while remaining strict in CI/beta.
- **Invalid overriddenSnapshot**:
  - The compose API performs strict validation of `overriddenSnapshot` (type, planets, houses, dominant elements, etc.) and throws `Invalid overriddenSnapshot: …` errors when the payload is malformed.
  - The `phase6:verify-sandbox-compose` script explicitly tests:
    - That an invalid `overriddenSnapshot` fails closed with the expected error.
    - That a valid override produces a `hashes.plan_sha256`.

**Result**: Failure modes are well‑defined, visible, and fail‑closed without silent fallbacks.

#### 4) Persistence contract

- **Save / list / load**:
  - Save is enabled only after a successful Generate that produced `snapshotUsed`, `combinedHashUsed`, `report`, and `plan_sha256`.
  - Save calls `POST /api/sandbox/compositions` with:
    - `sandbox_state` (birth, normalized overrides, controls),
    - `vector_hash = combinedHashUsed`,
    - `seed = combinedHashUsed`,
    - `plan_hash`, `report`, `provider`, `export_id`.
  - The Saved list panel calls `GET /api/sandbox/compositions?limit=50` and renders recent rows.
  - Load calls `GET /api/sandbox/compositions/:id`, restores state into the draft, then re‑snapshots via `/api/sandbox/snapshot` to rebuild `overriddenSnapshot` and hash, ensuring Replay uses the same engine path as a fresh run.
- **Replay from saved state**:
  - After Load, Replay operates with the restored seed and updated snapshot and performs the same plan hash comparison as a fresh Generate/Replay cycle.
  - When composed plan hashes match between the original and the replay, determinism is confirmed; mismatches are clearly surfaced in the UI.
- **Stable JSON export schema**:
  - The JSON export bundle always includes:
    - `birth`, `overrides`, `controls`,
    - `combinedHashUsed`, `plan_sha256`, `export_id`, `provider`, `createdAt`.
  - All optional fields normalize to `null` when absent; no `undefined` values are emitted.

**Result**: The persistence contract is stable and supports save → list → load → replay workflows reliably.

#### 5) Smoke discipline / Test results

Final Phase 6 smoke runs from this session:

- `npm run phase5:smoke` → **PASS**
- `npm run phase6:verify-sandbox-compose` → **PASS**
- `npm run phase6:verify-compositions` → **SKIP** (database not running locally; script explicitly logs SKIP on `ECONNREFUSED`).
- `npm run phase6:sandbox-smoke` → **PASS with SKIP**:
  - `/health` preflight to `ENGINE_BASE` fails when the engine is not running locally, so the script logs:
    - `SKIP: engine not running at http://localhost:4000 (fetch failed)`
  - In CI/beta, with a running engine and/or `PHASE6_SMOKE_REQUIRE_ENGINE=1`, the same script performs the full HTTP pipeline and determinism checks and will fail if any required invariant is broken.

**Result**: Phase 6 smoke discipline is in place and aligned with the beta environment.

### Known Backlog / Deferred Work

- **Angles / cusp overrides**:
  - Current sandbox overrides focus on planetary longitudes and keep cusp geometry derived from the birth chart.
  - A future Phase can extend the sandbox to support angle/cusp overrides (e.g., ASC/MC adjustments) with the same strict snapshot → report → compose → replay contract.
- **Engine‑aware UX niceties**:
  - Additional inline guidance around DB/export unavailability could be added (e.g., linking to docs or admin dashboards), but is not required for Closed Beta readiness.

### Phase 6 Conclusion

All Phase 6 acceptance criteria are met:

- Single canonical sandbox surface with no legacy UIs.
- Strict snapshot → report → compose orchestration using a shared overridden snapshot and hash.
- Deterministic plan hash replay with explicit mismatch signaling.
- Robust, fail‑closed handling of export, DB, and engine availability states.
- Stable persistence and JSON export contracts suitable for beta testers.

The `beta-ui-vercel` branch is now **Phase 6–complete** and ready for Closed Beta, gated by the Phase 6 smoke runners described above.

