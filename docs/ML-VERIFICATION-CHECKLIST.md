# ML verification checklist

## A) Geolocation

- [x] **Log compose request (sanitized)**  
  - UI: `[COMPOSE_UI] Request body (sanitized):` in console before fetch.  
  - Backend: `[COMPOSE_API] Request body (sanitized):` and `[COMPOSE_API] Interpreted coords:` in Next route (`app/api/compose/route.ts`).
- [x] **Label vs coords**  
  - When geo denied / no coords: UI shows “Geolocation: denied — using default (40.71, -74.01)”. Backend uses NY default when `geo` missing. Label and coords match.

## B) ML pipeline

- [x] **ML_REQUIRED / fail-closed**  
  - `vnext/api/compose.ts`: if `!mlUsed` after `generatePlanMLOnly`, throw `ML_INFERENCE_UNAVAILABLE`.  
  - `vnextCompose` catch: on that code → **503**, `{ error, code: 'ML_INFERENCE_UNAVAILABLE', timestamp }`, **no** controls/audio.  
  - See `docs/ML-REQUIRED-ENFORCEMENT.md`.
- [x] **Node model loading (Windows)**  
  - tfjs-node native addon fails (“module could not be found”). **Single load path**: fs-based IOHandler + `@tensorflow/tfjs` + `tfjs-backend-wasm`, no tfjs-node.  
  - `vnext/ml/index.ts`: `createFsIOHandler`, `await tf.ready()`, then `loadModel(handler)`.
- [x] **Log line**  
  - `[COMPOSE_ML]` with `tf_backend`, `model_version`, `model_sha`, `inference_ms`, `ml_used`.  
  - Example: `ml_used=true`, `tf_backend=wasm`, `model_sha` ≠ `dev`, `inference_ms` > 0.
- [x] **Zero silent fallbacks**  
  - `studentVector` throws on load/inference failure (no fallback return).  
  - Compose always throws when `!mlUsed` (no success response with fallback).

## C) Proof command

- **Command:** `npm run proof:ml`  
  - Builds vnext, runs `npm run dev` (backend+ui), waits for `/health`, POSTs `/api/compose` twice (different sky params), asserts `telemetry.ml_used === true`, `telemetry.inference_ms > 0`, and control hashes differ.  
  - **PASS:** prints `[verify-ml] PASS: ...` and exits 0.  
  - **FAIL:** prints `[verify-ml] FAIL: <exact reason>` and exits 1.
- **Preflight:**  
  - `scripts/verify-ml-compose.js` (with `--start-dev`): before spawning dev, kills processes on 3000 and 3001, waits 2s, then starts dev.  
  - `scripts/dev-all.js`: on EADDRINUSE, kills processes on 3000/3001, retries, then exits with a clear message if still in use.

## D) Real feature encoding

- [x] **No mock vectors**  
  - Compose uses `encodeFeatures(snapshot)` from `fetchChartSnapshot` (sky/overlay/default).  
  - `GET /api/chart-snapshot?date=&time=&lat=&lon=` returns EphemerisSnapshot; compose fetches it and encodes.
