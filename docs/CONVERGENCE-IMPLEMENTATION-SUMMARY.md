# Convergence Implementation Summary

**Date:** 2026-02-05  
**Status:** ✅ Complete - Option 1 (API-first) convergence implemented

---

## Executive Summary

Successfully implemented **Option 1 (API-first)** convergence, establishing a single canonical composition engine (backend vNext). The frontend now consumes backend-generated plans for Tone.js fallback playback, eliminating the divergent hash-based 8-note loop. MIDI export added as a deterministic artifact adapter.

---

## Files Modified

### Backend (vNext)

1. **`vnext/plan-hash.ts`** (NEW)
   - Implements `canonicalizePlan()`: deterministic event sorting + time rounding (1ms precision)
   - Implements `computePlanHash()`: SHA256 of canonicalized plan JSON
   - Comparator: (t0 asc) → (channel asc) → (pitch asc) → (t1 asc) → (velocity asc) → (group asc)

2. **`vnext/explainer/contracts.ts`**
   - Extended `ComposeRequest`: added optional `includePlan?: boolean | number`, `includeMidi?: boolean | number`
   - Extended `ComposeResponse`: added optional `plan?: Plan`, `hashes.plan_sha256` (always present), `hashes.midi_sha256?` (when MIDI included), `artifacts.midi?`

3. **`vnext/api/compose.ts`**
   - Import: `computePlanHash` from `plan-hash`, `planToMidiBase64` from `midi/plan-to-midi`
   - Always computes `plan_sha256` and adds to `hashes.plan_sha256`
   - Conditionally includes `plan` in response when `!audio_export_available` OR `request.includePlan === true/1` OR `ALWAYS_INCLUDE_PLAN=1`
   - Conditionally generates MIDI when `request.includeMidi === true/1` OR `ENABLE_MIDI_EXPORT=1`
   - Adds `artifacts.midi` and `hashes.midi_sha256` when MIDI is generated

4. **`vnext/midi/plan-to-midi.ts`** (NEW)
   - Implements `planToMidiBase64()`: converts Plan → MIDI bytes (base64 + sha256)
   - Uses **`@tonejs/midi`** as the ONLY MIDI library (PPQ=480, fixed)
   - Groups events by channel (melody/harmony/bass/rhythm) into separate tracks
   - Maps velocity 0..1 → 1..127 → normalize to 0..1 for @tonejs/midi
   - Converts timing: plan.t0/t1 (seconds) → MIDI ticks using bpm + PPQ
   - Uses canonical event ordering (same as plan hashing)
   - Returns: `{ base64, sha256, ppq: 480, tracks, bytes }`

5. **`vnext/client/plan-to-tone-events.ts`** (NEW)
   - Browser-safe Plan → Tone.js events converter (NO Node.js imports)
   - Pure TypeScript for Next client bundle
   - Converts MIDI pitch → note name (C4, D#5, etc.)
   - Returns sorted Tone events with time, note, duration, velocity, channel

### Frontend (Next.js)

6. **`apps/web/app/page.tsx`**
   - Added state: `composePlan` to store backend plan
   - Updated compose effect: stores `payload.plan` when present
   - **Removed:** hash-based 8-note loop fallback (`startPlanFallback`)
   - **Replaced with:** plan-driven Tone.js scheduling:
     - If `payload.plan` exists: imports `planToToneEvents` from `vnext/client/plan-to-tone-events`
     - Schedules all plan events with Tone.js synths per channel
     - Stops transport at `plan.durationSec`
   - If no plan and no WAV: shows "Audio unavailable" (no sound)

7. **`apps/web/app/api/compose/route.ts`**
   - **Removed:** dead code (`makeSnapshot`, `hnum`, `PLANETS` constants)
   - **Removed:** unused `crypto` import
   - Kept: request validation and proxy behavior unchanged

### Tests

8. **`vnext/scripts/test-plan-hash.ts`** (NEW)
   - Unit test: plan hash determinism
   - Asserts: same plan → same hash, reordered events → same hash, different plan → different hash, canonical JSON stability, time rounding prevents float jitter

9. **`vnext/scripts/test-midi-determinism.ts`** (NEW)
   - Unit test: MIDI export determinism
   - Asserts: same plan → same MIDI sha256/base64, MIDI structure (tracks, PPQ, bytes), different plan → different MIDI, valid MIDI header

10. **`package.json`**
    - Added scripts: `test:plan-hash`, `test:midi-determinism`
    - Added dependency: `@tonejs/midi` (pinned, backend-only)
    - Removed: `midi-writer-js` (replaced with @tonejs/midi)

---

## New Environment Variables (Optional)

- **`ALWAYS_INCLUDE_PLAN=1`**: Server-side flag to always include `plan` in response (default: only when `audio_export_available === false`)
- **`ENABLE_MIDI_EXPORT=1`**: Server-side flag to always generate MIDI (default: only when `includeMidi=1` in request)

**Note:** No breaking changes to existing env vars. All existing test env vars preserved.

---

## API Contract Changes (Backward Compatible)

### Request (`ComposeRequest`)
- **New optional fields:**
  - `includePlan?: boolean | number` - Request plan in response
  - `includeMidi?: boolean | number` - Request MIDI artifact

### Response (`ComposeResponse`)
- **Always present:**
  - `hashes.plan_sha256: string` - SHA256 of canonical plan
- **Conditionally present:**
  - `plan?: Plan` - Full plan object (when `audio_export_available === false` OR `includePlan=1` OR `ALWAYS_INCLUDE_PLAN=1`)
  - `artifacts.midi?: { base64, sha256, ppq, tracks, bytes }` - MIDI artifact (when `includeMidi=1` OR `ENABLE_MIDI_EXPORT=1`)
  - `hashes.midi_sha256?: string` - MIDI SHA256 (when MIDI included)

**All existing fields unchanged:** `controls`, `gate_report`, `audio`, `text`, `explanation`, `hashes.control`, `hashes.audio`, `hashes.explanation`, `artifacts.*` (except new `midi`), `telemetry`.

---

## Test Status

### Existing Tests (Unchanged)
- ✅ `npm run test:compose-golden-run` - Still works (POSTs to live `/api/compose`, asserts audio sha, wav_valid)
- ✅ `npm run test:compose-golden-baseline` - Still works
- ✅ `npm run test:compose-soak` - Still works (in-process, mocked chart-snapshot)
- ✅ `npm run test:compose-live-soak` - Still works (live HTTP, fixed body)

### New Tests
- ✅ `npm run test:plan-hash` - Unit test for plan hash determinism
- ✅ `npm run test:midi-determinism` - Unit test for MIDI export determinism

---

## Acceptance Checklist

### ✅ Backend
- [x] `/api/compose` response includes `hashes.plan_sha256` on every 200 response
- [x] When `ENABLE_WAV_EXPORT=0` (or audio not returned), response includes `plan` (unless explicitly suppressed)
- [x] `plan_sha256` matches canonical hash of returned plan
- [x] When `includeMidi=1` (or `ENABLE_MIDI_EXPORT=1`), response includes `artifacts.midi.base64` and `artifacts.midi.sha256`

### ✅ Frontend
- [x] No code path generates notes locally (removed hash-based loop)
- [x] If `payload.audio` exists: plays WAV
- [x] Else if `payload.plan` exists: plays Tone scheduled events matching plan
- [x] Else: shows "Audio unavailable" and stays silent
- [x] Old 8-note loop deleted/unreachable

### ✅ Repo Hygiene
- [x] No request schema breaking changes (only optional fields added)
- [x] No env var changes (only optional new vars)
- [x] Golden/soak scripts still run
- [x] Next build succeeds without server-only imports (browser-safe `plan-to-tone-events.ts`)

---

## Next Steps (Future PRs)

1. **E2E Test:** Add Playwright/integration test that:
   - POSTs fixed request to `/api/compose`
   - Asserts `plan_sha256` matches canonical hash
   - Loads UI, triggers play with fallback
   - Asserts scheduled events count matches `plan.events.length`

2. **Documentation:** Update API docs with new optional fields

3. **Monitoring:** Add telemetry for "frontend used backend plan" vs "frontend used WAV"

---

## Migration Notes

- **Frontend:** No migration needed - automatically uses backend plan when WAV unavailable
- **Backend:** No migration needed - backward compatible (only adds optional fields)
- **Tests:** No changes required - existing tests pass unchanged

---

*Implementation complete. Ready for review and merge.*
