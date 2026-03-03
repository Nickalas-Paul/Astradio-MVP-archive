# Phase 6 — Sandbox Contract & Decision

**Lab environment for professionals and amateurs: interactive chart workbench.** Not a demo. Option A (strict alignment) is locked: all three outputs from the same sandbox chart state.

---

## Revised invariant (Phase 6 exception, tightly scoped)

- You may edit **`vnext/api/compose.ts`** ONLY to add an additive sandbox branch that accepts an overridden snapshot and uses `generateArchitectureFromSnapshot`.
- No changes to **`vnext/core/architecture-engine.ts`** and no changes to **`vnext/feature-encode.ts`**.
- No silent fallbacks. If overridden snapshot is provided and invalid, fail closed with a clear error.
- Add smoke coverage for this path.

---

## Wheel population and editing (confirmed, file references)

- **`/sandbox`** (`apps/web/app/sandbox/page.tsx`): Wheel is **read-only**. It uses **`WheelCanvas`** (`apps/web/src/components/WheelCanvas.tsx`) with `chartData={snapshotForWheel ?? chartData ?? undefined}`. Data comes from one POST `/api/sandbox/snapshot` on mount with default birth + empty overrides. No drag; no override state. See audit Section 6 Step 0 B.
- **`/sandbox/builder`** (`apps/web/app/sandbox/builder/page.tsx`): Wheel is **editable**. It uses **`WheelCanvasBuilder`** (`apps/web/src/components/sandbox/WheelCanvasBuilder.tsx`) with `snapshot={currentSnapshot}` and `overrides={draft.overrides}`. Drag calls `onOverrideChange(planet, lonDeg)` which updates **`draft.overrides.planets[planet].lonDeg`** via `handleOverrideChange` in the builder page (lines 204–245). Degree panel (`DegreePanel`) also updates the same overrides.

**Canonical route for the lab:** **`/sandbox`** becomes the single canonical lab surface. The editable wheel (WheelCanvasBuilder) and builder controls (birth form, degree panel, report, compose) are **merged into `/sandbox`**, so the canonical route exposes the drag-and-drop wheel. `/sandbox/builder` is eliminated as a separate product surface (redirect to `/sandbox` or remove).

---

## House placement stance (Phase 6)

- **Houses remain birth-derived.** Angle overrides (ASC/MC) are rejected today (`vnext/api/sandbox-snapshot.ts` `validateSandboxOverrides`). Phase 6 does not add angle or cusp overrides.
- **Drag constraints and house number display** are computed from the current snapshot’s **cusps** (birth-derived). “Constrain to house” clamps longitude to the house arc the planet started in; house number = which cusp arc contains the planet’s longitude.
- **UI requirement:** Add a clear note on the Sandbox page: **“Houses are from birth chart geometry in Phase 6.”**
- **Backlog:** A tracked doc note for **Phase 6.5 / Phase 7** must be added: **angle/cusp override support** (ASC/MC or house cusp override mode) so users can force house boundaries in a future release.

---

## Required Sandbox API contract (unambiguous)

### Snapshot

- **Request:** `POST /api/sandbox/snapshot`  
  Body: `{ birth: SandboxBirth, overrides: SandboxOverrides }`
- **Response:** `{ snapshot: EphemerisSnapshot, meta: { baseHash, overridesHash, combinedHash } }`
- Use: Viz wheel and as source for `overriddenSnapshot` in compose.

### Report

- **Request:** `POST /api/sandbox/report`  
  Body: `{ birth: SandboxBirth, overrides: SandboxOverrides, seed?: string }`
- **Response:** Report JSON (features, personality, guidance, explanation, seed, meta.combinedHash).
- Use: Text report document panel.

### Compose (audio)

- **Request:** `POST /api/compose`  
  Body: `{ mode: 'sandbox', controls: ControlSurfacePayload subset, seed: string, overriddenSnapshot: EphemerisSnapshot }`
  - **No chartData-only workaround.** Sandbox must send **overriddenSnapshot** (the same shape returned by POST `/api/sandbox/snapshot`).
- **Compose behavior:**
  - When `overriddenSnapshot` is present and valid: use **`generateArchitectureFromSnapshot(overriddenSnapshot, payload.hash)`** for the architecture step. Audio is then generated from that overridden chart.
  - When `overriddenSnapshot` is missing or invalid: fail closed with a clear error (no silent fallback to ephemeris).
- **Response:** Must include `planHash` (e.g. `hashes.plan_sha256`), `export_id`, provider info, and any debug fields on failure.

---

## State object (unchanged)

- **Sandbox chart state:** `{ birth: SandboxBirth, overrides: SandboxOverrides }` with optional `controls` for composition.
- **Saved composition record:** sandbox_state, vector_hash, seed, plan_hash, report, provider, provider_version, export_id, created_at, updated_at.

---

## Implementation steps (atomic commits, builds green)

1. **Compose sandbox override path (server)** — Add request validation for `overriddenSnapshot` (EphemerisSnapshot shape). Add sandbox-only branch using `generateArchitectureFromSnapshot`. Fail closed if invalid. Add unit-ish or harness verification.
2. **Web: canonical Sandbox surface** — Make `/sandbox` the canonical lab; merge builder into `/sandbox`; blank canvas default.
3. **Wheel editing** — WheelCanvasBuilder as canonical wheel; every planet draggable; 0.1° precision; live sign-degree and house number; default “constrain to house” with toggle.
4. **Triple-output Generate** — One Generate: snapshot → report → compose (compose includes `overriddenSnapshot` from snapshot call). Per-panel loading/error.
5. **Playback wiring** — Play/stop/replay via `/api/exports/:export_id`; download.
6. **Save/list/reload/export** — Save triple-bound artifact; reload restores state + report; replay composes from same overriddenSnapshot/state.
7. **Phase 6 smoke** — snapshot 200, report 200, compose 200 with overriddenSnapshot, exports stream 200, save/list/get, replay determinism (planHash match).

---

## Required walkthrough

**Scenario:** “August 16, 1979, Sacramento, CA + user drags 8 planets into Scorpio (and within 12th house if cusps allow) → viz/text/audio from that sandbox state → save → reload → replay.”

**Concrete payloads and calls:**

1. **Birth:** `birth = { date: '1979-08-16', time: '12:00', lat: 38.5816, lon: -121.4944, tz: 'UTC', houseSystem: 'placidus' }` (Sacramento resolved to lat/lon).

2. **Snapshot:**  
   `POST /api/sandbox/snapshot`  
   Body: `{ birth, overrides: { planets: {} } }`  
   Response: `{ snapshot: { ts, tz, lat, lon, houseSystem, planets, houses, aspects, moonPhase, dominantElements }, meta: { baseHash, overridesHash, combinedHash } }`.  
   Wheel shows ephemeris chart; user sees house boundaries.

3. **Overrides:** User drags or types so that Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus all have longitude 220° (Scorpio).  
   `overrides.planets = { sun: { lonDeg: 220 }, moon: { lonDeg: 220 }, mercury: { lonDeg: 220 }, venus: { lonDeg: 220 }, mars: { lonDeg: 220 }, jupiter: { lonDeg: 220 }, saturn: { lonDeg: 220 }, uranus: { lonDeg: 220 } }`.  
   Debounced `POST /api/sandbox/snapshot` with `{ birth, overrides }` → new `snapshot` and `meta.combinedHash`. Wheel shows 8 in Scorpio; if 12th house spans 220°, they appear in house 12.

4. **Generate triple output:**  
   - **Viz:** Wheel already reflects last snapshot (overridden).  
   - **Text:** `POST /api/sandbox/report` with `{ birth, overrides, seed: meta.combinedHash }` → report panel.  
   - **Audio:** `POST /api/compose` with body:  
     `{ mode: 'sandbox', controls: { arc_shape: 0.5, density_level: 0.6, ... }, seed: combinedHash, overriddenSnapshot: <exact snapshot from step 3 response> }`.  
     Compose uses `generateArchitectureFromSnapshot(overriddenSnapshot, payload.hash)` → plan → render → `export_id`. Response includes `hashes.plan_sha256`, `export_id`, provider info.  
   Playback URL: `/api/exports/:export_id`.

5. **Save:** `POST /api/sandbox/compositions` with `{ sandbox_state: { birth, overrides, controls }, vector_hash: combinedHash, seed, plan_hash, report, provider, export_id }` → `{ id, created_at }`.

6. **List:** `GET /api/sandbox/compositions` → list includes saved item.

7. **Reload:** `GET /api/sandbox/compositions/:id` → restore `birth`, `overrides`, `controls`; show saved report; wheel can be repopulated by re-calling snapshot with saved state.

8. **Replay:** Call `POST /api/sandbox/snapshot` with saved `{ birth, overrides }` to get fresh `overriddenSnapshot`, then `POST /api/compose` with same `overriddenSnapshot`, same `controls`, same `seed`. Expect same `plan_sha256` (determinism).

---

## Backlog note (Phase 6.5 / 7)

**Angle/cusp override support:** Allow ASC/MC (and optionally full house cusp) overrides so users can force “12th house” (or any house) to span a chosen longitude range regardless of birth geometry. Requires backend: accept angles in sandbox overrides and recalc cusps (or explicit cusp override mode). Track in product backlog for Phase 6.5 or Phase 7.
