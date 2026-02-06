# WAV export implementation plan (ENABLE_WAV_EXPORT=1)

## Current reality

- **Logs:** Render shows `[COMPOSE] WAV export unavailable (module missing or render failed): <message>` when `ENABLE_WAV_EXPORT=1` and the WAV path fails.
- **Contract:** Compose response has `audio_export_available`, `audio.base64`, `audio.sha256`, `audio.size_bytes`. When export is enabled and the renderer succeeds, these are non-empty. No change to this contract.

## Where the “stub” message comes from

There is **no literal stub** in code. The message is emitted by the **catch** in `vnext/api/compose.ts` when either:

1. **Dynamic import fails:** `await import('../audio/wav-renderer')` throws (e.g. module not found, path wrong at runtime).
2. **renderWav60s throws:** `mod.renderWav60s(plan, payload, payload.hash, options)` throws (e.g. plan/payload shape, or runtime error inside the renderer).

The real implementation lives in **`vnext/audio/wav-renderer.ts`** (deterministic synth: oscillators, ADSR, filter, reverb). It is compiled to **`dist/vnext/vnext/audio/wav-renderer.js`** by `npm run vnext:build`. Compose runs from `dist/vnext/vnext/api/compose.js` and uses `import('../audio/wav-renderer')`, which resolves to `dist/vnext/vnext/audio/wav-renderer.js`.

## Root-cause checklist (auditable)

1. **Deploy artifact**
   - Confirm the Render build runs the same step that produces `dist/vnext/vnext/` (e.g. `npm run vnext:build` or equivalent).
   - Confirm `dist/vnext/vnext/audio/wav-renderer.js` exists in the deployed bundle (e.g. list files in build output or add a startup check that requires the file).

2. **Actual error**
   - The current catch logs `audioError.message`. On Render, inspect the **full** log line for `[COMPOSE] WAV export unavailable`; the suffix is the real error (e.g. `Cannot find module '../audio/wav-renderer'` vs `plan.events is not iterable`).
   - Optional: in compose, log `audioError.stack` once (or when `DEBUG_WAV=1`) so stack traces are available without changing default response shape.

3. **Plan/payload shape**
   - `renderWav60s(plan, payload, payload.hash, options)` expects:
     - `plan`: `{ durationSec?, events? }` (events sorted by t0; each event has t0, t1, channel, pitch, velocity).
     - `payload`: at least `element_dominance`, `aspect_tension` (used for preset and filter bias).
   - If the server-side plan or payload from `generatePlanMLOnly` / `generateControlPayload` differs from what the renderer expects, add defensive defaults in the renderer (it already uses `plan?.events ?? []`, `plan?.durationSec ?? 60`) or normalize in compose before calling.

4. **Node / environment**
   - Render runs Node 20.x; the renderer uses only built-ins (`crypto`, `Buffer`, `Math`). No native addons. If the error points at a missing global or API, note the Node version and the exact error.

## Implementation steps (separate commit)

- **Step 1 (diagnostics):** In `vnext/api/compose.ts`, in the WAV catch block, ensure the **full** error message and, if present, `err.code` (e.g. `MODULE_NOT_FOUND`) are logged. Optionally when `process.env.DEBUG_WAV === '1'`, log `err.stack`. No change to response shape or to when we throw.
- **Step 2 (build/deploy):** Confirm Render build includes `vnext:build` (or that `dist/vnext/vnext/audio/wav-renderer.js` is present in the image). If not, add the build step or adjust the deploy so the WAV module is present.
- **Step 3 (defensive renderer):** If logs show a runtime error inside `renderWav60s` (e.g. bad plan shape), add guards in `vnext/audio/wav-renderer.ts`: validate or coerce `plan.events` to an array, clamp numeric fields, and ensure `selectPreset` never throws (e.g. unknown `element_dominance` → default preset).
- **Step 4 (verification):** After deploy, run one POST to `/api/compose` with `ENABLE_WAV_EXPORT=1` and confirm `audio_export_available === true` and `audio.size_bytes > 0`, `audio.sha256` non-empty. Re-run golden or live soak to confirm determinism.

## What not to change

- Compose request/response contract (other than making audio actually populated when export is enabled).
- Rate limiting, soak bypass, or trust proxy behavior.
- Plan generation or ML path; only the WAV **rendering** path is in scope.

## Files to touch (second commit)

- `vnext/api/compose.ts` — improve WAV catch logging (message, code, optional stack when DEBUG_WAV=1).
- Optionally `vnext/audio/wav-renderer.ts` — defensive checks for plan/payload if logs show shape issues.
- Build/deploy config — ensure `dist/vnext/vnext/audio/wav-renderer.js` is built and deployed (no code change if already correct).
