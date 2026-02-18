# Local ML Enablement

Local dev must support real ML (no noop/dev) when `ML_REQUIRED=1`, so the 30-minute soak and `/api/compose` return `telemetry.ml_used === true`, non-dev `model_sha`, and non-noop `tf_backend`.

## Why noop/dev happened before

1. **Startup log:** The server called `validateModelRequirements()` from a vnext health module. That module did not exist (`vnext/api/health.ts` was missing), so the server used an in-server fallback that always returned `{ backend: 'noop', sha256: 'dev' }`. Hence the log line: `[vNext] TF backend=noop model_sha=dev out=[0]`.
2. **Model path:** Default `RUNTIME_MODEL` is `student-v2.8-slice-batch`; that folder contains training metadata JSON, not TFJS layers. The ML loader falls back to `models/student-v2.2`, which is a valid TFJS model. So at **request** time, compose could load the real model; only the **startup** probe showed noop/dev because the probe was the fallback.

## Fix (what we did)

1. **Added `vnext/api/health.ts`** – Exports `validateModelRequirements()` (one real inference at startup) and `getMLStatus()` (for GET /api/ml-status). Startup now runs a real probe and logs actual backend + model_sha. If `ML_REQUIRED=1` and model load fails, we throw (no silent noop).
2. **VNEXT_MODEL_PATH** – In `vnext/ml/index.ts`, `resolveModelDir()` checks `process.env.VNEXT_MODEL_PATH` first (dir or path to `model.json`). Use this to point at a bundled artifact.
3. **Server** – If `ML_REQUIRED=1` and the probe returns noop or dev/local/unknown sha, server exits with a clear message. Added GET `/api/ml-status` that returns `tf_backend`, `model_sha`, `ml_used`, `inference_ms`, `model_path_hint`.
4. **dev-all** – Forwards `process.env` to the backend child, so `ML_REQUIRED=1` set in the shell is visible to the server.

## One-command developer experience

**Prereq:** Build vnext once so the health module is compiled: `npm run vnext:build`. Repo already includes `models/student-v2.2/model.json` and `group1-shard1of1.bin`.

### Bash

```bash
# Backend only (recommended for soak / ML verification)
ML_REQUIRED=1 npm run dev:backend

# Full stack (backend + UI)
ML_REQUIRED=1 npm run dev
```

### PowerShell

```powershell
# Backend only
$env:ML_REQUIRED = "1"
npm run dev:backend

# Full stack
$env:ML_REQUIRED = "1"
npm run dev
```

### Optional: point at a specific model

```bash
# Bash
export VNEXT_MODEL_PATH=/path/to/dir/containing/model.json
ML_REQUIRED=1 npm run dev:backend
```

```powershell
# PowerShell
$env:VNEXT_MODEL_PATH = "C:\path\to\dir\containing\model.json"
$env:ML_REQUIRED = "1"
npm run dev:backend
```

## Quick validation (telemetry proof)

After the backend is running with `ML_REQUIRED=1`, confirm real ML:

### 1. GET /api/ml-status (proof fields)

**Bash (curl):**
```bash
curl -s http://localhost:3000/api/ml-status | jq .
```

**PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/ml-status" | ConvertTo-Json -Depth 5
```

**Expected:** `tf_backend` not `"noop"`, `model_sha` not `dev`/`local`/`unknown`, `ml_used: true`, `inference_ms > 0`, `model_path_hint` showing the resolved dir.

### 2. One /api/compose call (telemetry in response)

**Bash:**
```bash
curl -s -X POST http://localhost:3000/api/compose \
  -H "Content-Type: application/json" \
  -d '{"mode":"sky","skyParams":{"latitude":40.71,"longitude":-74.01,"datetime":"2024-01-15T12:00:00Z"}}' \
  | jq '{ telemetry: .telemetry, has_audio: (.audio.url != null or .audio.base64 != null) }'
```

**PowerShell:**
```powershell
$body = '{"mode":"sky","skyParams":{"latitude":40.71,"longitude":-74.01,"datetime":"2024-01-15T12:00:00Z"}}'
$r = Invoke-RestMethod -Uri "http://localhost:3000/api/compose" -Method Post -Body $body -ContentType "application/json"
$r.telemetry | ConvertTo-Json
# Check: ml_used=true, model_sha not dev/local/unknown, tf_backend not noop
```

**Expected:** `telemetry.ml_used === true`, `telemetry.model_sha` present and not dev/local/unknown, `telemetry.tf_backend` not `"noop"`.

### 3. Script (ml-status + one compose)

```bash
node scripts/verify-ml-status.js
# Or with custom base: BASE_URL=http://localhost:3000 node scripts/verify-ml-status.js
```

Exit 0 only if GET /api/ml-status and one POST /api/compose both show real ML (ml_used=true, non-dev model_sha, tf_backend!=noop).

## Fail-fast when ML_REQUIRED=1

If the model is missing or invalid, startup exits with:

```
[vNext] ML_REQUIRED=1 but model is noop/dev. Refusing to start.
[vNext] Ensure models/student-v2.2/model.json (and group1-shard1of1.bin) exist, or set VNEXT_MODEL_PATH.
```

Or:

```
vNext model health check failed: <error>
ML_REQUIRED=1 or STRICT_ML enabled - refusing to start without valid model
```

**What to do:** Run `npm run vnext:build`, ensure `models/student-v2.2/model.json` and `models/student-v2.2/group1-shard1of1.bin` exist, or set `VNEXT_MODEL_PATH` to a valid TFJS layers directory.
