# ML Fallback Paths Report

## 1. Identified fallback paths

| File | Line(s) | Trigger | Returns |
|------|--------|---------|--------|
| **vnext/ml/index.ts** | 132–140 | Any error in `studentVector` (model load, `fetch`/`file://` failure, inference exception, shape mismatch) | `{ vector: [0.5,0.5,0.5,0.5,0.5,0.5], confidence: 0, modelVersion: 'fallback', timestamp }` |
| **server/index.js** | 26 | `healthMod` (dist/vnext/api/health) not found or load fails | `validateModelRequirements` = `async () => ({ backend: "noop", sha256: "dev", outShape: [0] })` |
| **server/index.js** | 65–74 | `validateModelRequirements()` throws (e.g. model health check fails) | If `STRICT_ML=true`: `process.exit(1)`. Else: log "Continuing in dev mode with fallback enabled", startup continues |
| **server/index.js** | 22 | `composeMod` (dist/vnext/api/compose) not found or load fails | `vnextCompose` = `(req, res) => res.status(501).json({ ok: false, error: "compose_unavailable" })` |
| **server/index.js** | 23–24 | `shadowMod` / `canaryMod` missing | `shadowMiddleware` / `canaryRouter` = noop middleware / router |
| **vnext/model-loader.ts** | 109–127 | Model integrity check fails for current model | `performRollback()` to `rollback_target`; uses fallback model (not used by ml inference path today) |
| **vnext/plan-generator.ts** | 49–108 | `studentVector` returns `modelVersion: 'fallback'` | Continues with fallback vector; no throw. `diag.modelVersion` = `'fallback'`, `source` = `student-fallback+rerank` |

## 2. "dev out=[0]" / "TF backend=noop"

- **server/index.js:66**: logs `[vNext] TF backend=... model_sha=... out=...`.
- When health module is missing, `validateModelRequirements` is the noop above → **backend=`"noop"`**, **out=`[0]`**.
- **Log line**: `[vNext] TF backend=noop model_sha=dev out=[0]`.

## 3. Relevant try/catch and default controls

- **vnext/ml/index.ts:100–141**: `try` around load + predict; `catch` returns fallback vector (see table).
- **vnext/api/compose.ts**: Outer `try/catch` around `compose()`; on error rethrows as `Compose API error: ...`. No default controls returned on error.
- **app/api/compose/route.ts:97**: Engine failure → 4xx/5xx JSON with `ENGINE_UNAVAILABLE` / `ENGINE_ERROR`; no silent fallback, no controls.

## 4. Model path vs RUNTIME_MODEL

- **vnext/api/compose.ts:30**: `RUNTIME_MODEL` → `student-v2.8-slice-batch` (used for provenance / logging only).
- **vnext/ml/index.ts:92–95**: Hardcoded **student-v2.2** (`MODEL_DIR`, `MODEL_JSON_FILE`, `MODEL_HTTP_URL`). Actual load uses **student-v2.2**, not v2.8.

## 5. Node "fetch failed … not implemented"

- **vnext/ml/index.ts**: Uses `tf.loadLayersModel(modelPath)` with `file://...` or HTTP.
- In Node, default `fetch` does not support `file://` → "fetch failed … not implemented" when using `file://`.
- Fix: use `@tensorflow/tfjs-node` and `tf.io.fileSystem(path)` (or equivalent Node IOHandler) for filesystem model loading.

## 6. Feature vector shape

- **vnext/contracts.ts**: `FeatureVec` = `Float32Array` length **64**.
- **vnext/ml/index.ts:110**: `tf.tensor2d([Array.from(feat)], [1, 64])` expects **64** dims.
- **vnext/api/compose.ts:72**: Mock `featureVec` has **6** dims → shape mismatch → inference fails → **fallback** used.

## 7. Summary

| Fallback | Location | Condition | Effect |
|----------|----------|-----------|--------|
| ML inference fallback | vnext/ml/index.ts | Load or inference fails | `modelVersion: 'fallback'`, fixed 6-dim vector |
| Health noop | server/index.js | No health module | `backend=noop`, `out=[0]` |
| Dev fallback mode | server/index.js | Health check throws, `STRICT_ML` not `true` | Continue startup with fallback |
| Compose 501 | server/index.js | No compose module | 501 `compose_unavailable` |
| Rollback model | vnext/model-loader.ts | Integrity check fails | Use rollback target (separate from ml path) |

Implementing **ML_REQUIRED**, **Node model loading** (tfjs-node + fileSystem), **64-dim featureVec**, and **ml_used** logging will allow proving real ML inference and fail-closed behavior when ML is unavailable.
