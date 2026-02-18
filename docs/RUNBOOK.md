# Astradio MVP Runbook

## Emergency Procedures

### Disable Visualization Engine
```bash
# Set environment variable
export ENABLE_VIZ_ENGINE=false

# Or via URL parameter
curl "http://localhost:3000?viz=0"
```

### Rollback Composition Model
```bash
# Update model version in compose route
# Change modelVersions.audio from "v1.1" to "v1.0"
# Redeploy
```

### Emergency Rate Limit Bypass
```bash
# Temporarily increase limits in route handlers
# Change RATE_LIMIT_MAX from 50 to 1000
# Monitor for abuse
```

## Single deployment branch (Render + Vercel)

Use **one** shared branch so both Render (backend) and Vercel (frontend) deploy the same SHA.

| Item | Value |
|------|--------|
| **Branch** | `beta-ui-vercel` |
| **Remote tracking** | `origin/beta-ui-vercel` |
| **Verify Render** | Dashboard → Service → Build & Deploy → **Branch** = `beta-ui-vercel`. Redeploy to pick up latest SHA. |
| **Verify Vercel** | Project Settings → Git → **Production Branch** = `beta-ui-vercel`. Redeploy to pick up latest SHA. |

After pushing to `beta-ui-vercel`, confirm both platforms show the same commit (e.g. `git rev-parse HEAD` = Render deploy commit = Vercel deploy commit).

## Deployment / API gotchas

### POST /api/compose returns 400 HTML
The server uses **one** global `express.json()` (in `server/index.js`). Do **not** add a second `express.json()` on the `/api/compose` or `/api/render` route: the first parser consumes the request body; a second parser would read an empty stream, throw `SyntaxError`, and Express would return 400 with generic HTML. The route handlers use the body already parsed by the global middleware.

## Run soak locally (zero 429)

The `/api/compose` rate limiter allows 10 requests per 15 minutes by default, which is too strict for soak (8–12 requests/min for 30 minutes). In **development only**, use one of the following so soak sees 0×429.

### Backend: enable soak-friendly limits (dev only)

Start the backend with `NODE_ENV=development` and either disable the compose limiter or raise the limit:

**Option A – disable compose rate limit (soak / load testing):**
```powershell
# PowerShell (Windows)
$env:NODE_ENV="development"; $env:DISABLE_RATE_LIMIT="1"; node server/index.js
```
```bash
# Bash (Linux / macOS / WSL)
NODE_ENV=development DISABLE_RATE_LIMIT=1 node server/index.js
```
Alternatively use `SOAK_MODE=1` instead of `DISABLE_RATE_LIMIT=1`.

**Option B – higher limit (e.g. 72 requests per minute):**
```powershell
# PowerShell (Windows)
$env:NODE_ENV="development"; $env:COMPOSE_RPM="72"; node server/index.js
```
```bash
# Bash (Linux / macOS / WSL)
NODE_ENV=development COMPOSE_RPM=72 node server/index.js
```

Production limits are unchanged; these env vars apply only when `NODE_ENV=development`.

### 2-minute smoke (5–8s jitter, 0×429 expected)

```powershell
# PowerShell – from repo root (or soak-only-repo)
$env:BASE_URL="http://localhost:3000"; $env:SOAK_DURATION_MINUTES="2"; $env:SOAK_SLEEP_MIN_MS="5000"; $env:SOAK_SLEEP_MAX_MS="8000"; node soak-only-repo/scripts/soak-runner.js
```
```bash
# Bash – from repo root (or soak-only-repo)
BASE_URL=http://localhost:3000 SOAK_DURATION_MINUTES=2 SOAK_SLEEP_MIN_MS=5000 SOAK_SLEEP_MAX_MS=8000 node soak-only-repo/scripts/soak-runner.js
```

If the soak runner lives in the main repo:
```bash
BASE_URL=http://localhost:3000 SOAK_DURATION_MINUTES=2 SOAK_SLEEP_MIN_MS=5000 SOAK_SLEEP_MAX_MS=8000 node scripts/soak-runner.js
```

### 30-minute soak (5–8s jitter, 0×429 expected)

```powershell
# PowerShell
$env:BASE_URL="http://localhost:3000"; $env:SOAK_DURATION_MINUTES="30"; $env:SOAK_SLEEP_MIN_MS="5000"; $env:SOAK_SLEEP_MAX_MS="8000"; node soak-only-repo/scripts/soak-runner.js
```
```bash
# Bash
BASE_URL=http://localhost:3000 SOAK_DURATION_MINUTES=30 SOAK_SLEEP_MIN_MS=5000 SOAK_SLEEP_MAX_MS=8000 node soak-only-repo/scripts/soak-runner.js
```

Ensure the backend is started with one of the dev overrides above (e.g. `DISABLE_RATE_LIMIT=1` or `COMPOSE_RPM=72`) before running smoke or 30-min soak.

### Live soak against Render (production-like)

Runs the vnext live soak script against the deployed Render backend (`https://astradio-mvp-archive.onrender.com`). The script does a preflight (GET `/health`, one POST `/api/compose`), prints rate limit headers and `audio_export_available` / `audio.size_bytes` / `audio.sha256`, then runs N compose requests and asserts identical audio sha256 and gate pass.

- **Default (no bypass):** 8 runs, fits the 10/15min compose limit. No `SOAK_TOKEN` needed.
- **With soak bypass:** Set `SOAK_TOKEN` on Render and locally to the same value; script sends `X-Soak-Token` and runs 30 times (bypass does not count against the limiter).

**Render env vars (optional but required for audio + 30-run soak):**

| Variable | Value | Purpose |
|----------|--------|---------|
| `ENABLE_WAV_EXPORT` | `1` | Enable inline WAV in compose response (`audio_export_available`, `audio.size_bytes`, `audio.sha256`). Without it, preflight fails. |
| `SOAK_TOKEN` | `astradio_soak_96db14c_prod` | When request has header `X-Soak-Token` matching this value, the compose rate limiter is skipped for that request only. Set same value locally to run 30-run soak. |

**PowerShell (from repo root):**

```powershell
# 8 runs, no bypass (works with default 10/15min limit)
$env:ASTRADIO_BASE_URL="https://astradio-mvp-archive.onrender.com"; npm run test:compose-live-soak

# 30 runs with soak bypass (SOAK_TOKEN must match Render env)
$env:ASTRADIO_BASE_URL="https://astradio-mvp-archive.onrender.com"; $env:SOAK_TOKEN="astradio_soak_96db14c_prod"; npm run test:compose-live-soak
```

Override run count: `$env:LIVE_SOAK_RUNS="12"; ...` (must be ≤ limit if not using `SOAK_TOKEN`).

**Verify soak bypass on 429:** When you get a 429 “Too many composition requests” from `/api/compose`, the response includes diagnostic headers (no secrets):

| Header | Value | Meaning |
|--------|--------|--------|
| `x-soak-env-present` | `1` or `0` | SOAK_TOKEN is set and non-empty on the server. |
| `x-soak-header-present` | `1` or `0` | Request included `X-Soak-Token` header. |
| `x-soak-token-match` | `1` or `0` | Header value exactly matches SOAK_TOKEN. |
| `x-soak-bypass-eligible` | `1` or `0` | Bypass would apply if this request had been allowed (env + header + match). |

Use these to see why bypass didn’t apply: env missing (`0`), header not sent (`0`), or token mismatch (`0`). Example (PowerShell): send one POST with `X-Soak-Token`, hit 429, then inspect headers:

```powershell
$body = '{"mode":"sandbox","chartData":{"date":"2025-01-15","time":"12:00","lat":40.7128,"lon":-74.006},"controls":{}}'
$h = @{ "Content-Type" = "application/json"; "X-Soak-Token" = "astradio_soak_96db14c_prod" }
try { Invoke-WebRequest -Uri "https://astradio-mvp-archive.onrender.com/api/compose" -Method POST -Headers $h -Body $body -UseBasicParsing } catch { $_.Exception.Response.Headers }
```

Or with curl (inspect response headers on 429):

```bash
curl -s -D - -X POST -H "Content-Type: application/json" -H "X-Soak-Token: astradio_soak_96db14c_prod" -d '{"mode":"sandbox","chartData":{"date":"2025-01-15","time":"12:00","lat":40.7128,"lon":-74.006},"controls":{}}' "https://astradio-mvp-archive.onrender.com/api/compose"
```

Look for `x-soak-env-present`, `x-soak-header-present`, `x-soak-token-match`, `x-soak-bypass-eligible` in the response headers (only present on 429 from the compose limiter).

### Golden set evaluation (no runtime changes)

Side-car tooling: runs a canonical set of compose requests (from `vnext/eval/golden-set.json`) against the live `/api/compose` endpoint and writes versioned results + a diffable report. Does not change server or compose API behavior.

**Artifacts:**

- **Input:** `vnext/eval/golden-set.json` — 20–50 canonical request bodies (sandbox, sky, overlay).
- **Output:** `vnext/eval/runs/<timestamp>_<gitsha>/results.json` and `report.md`.
- **Baseline:** `vnext/eval/baseline/results.json` — previous run used for diffing (audio sha, wav_valid, http_status, elapsed_ms, etc.).

**How to run against Render (PowerShell, from repo root):**

```powershell
# Run golden set; writes to vnext/eval/runs/<timestamp>_<gitsha>/
$env:ASTRADIO_BASE_URL="https://astradio-mvp-archive.onrender.com"; npm run test:compose-golden-run

# With soak bypass (recommended for 25 cases; SOAK_TOKEN must match Render env)
$env:ASTRADIO_BASE_URL="https://astradio-mvp-archive.onrender.com"; $env:SOAK_TOKEN="astradio_soak_96db14c_prod"; npm run test:compose-golden-run
```

**How to set/update baseline:**

```powershell
# Run golden set and copy latest results to vnext/eval/baseline/results.json
$env:ASTRADIO_BASE_URL="https://astradio-mvp-archive.onrender.com"; $env:SOAK_TOKEN="astradio_soak_96db14c_prod"; npm run test:compose-golden-baseline
```

Optional: `$env:GOLDEN_RUN_DELAY_MS="200"` (delay between requests, default 200).

**No runtime changes:** The golden runner only calls the real `/api/compose`; it does not modify server, rate limits, or response shape.

## Cross-service verification (Vercel ↔ Render)

**Confirmed (no config change):**

- **Frontend (Vercel):** Uses same-origin `/api/*` routes; Next API route handlers proxy to the engine using `API_BASE_URL` or `ENGINE_BASE_URL` or `BACKEND_URL` (server-side). Set one of these on Vercel to the Render base URL (e.g. `https://astradio-mvp-archive.onrender.com`) so compose/chart/ip-geo proxy to Render. No `NEXT_PUBLIC_*` needed; client never sees the backend URL.
- **CORS (Render):** Server allowlist comes from `CORS_ORIGINS` or `FRONTEND_URL` (comma-separated) and always allows `https://*.vercel.app` origins. So Vercel deployments are allowed without adding env vars if the request origin matches `*.vercel.app`. For custom domains, add the origin to `CORS_ORIGINS` on Render.

If the frontend is on Vercel and the backend on Render (same branch/commit): on Vercel set `API_BASE_URL` (or `ENGINE_BASE_URL` / `BACKEND_URL`) to the Render service URL. The backend (Render) does not use `API_BASE_URL`; that variable is only for the frontend’s server-side proxy.

## vNext ML model and assets

### Model files

- **Location:** `models/student-v2.2/`
- **Required files:**
  - `model.json` – TFJS layers topology
  - `group1-shard1of1.bin` – weights (required for inference)
  - `metadata.json` – optional provenance

### Environment variables

| Variable | Description |
|----------|-------------|
| `VNEXT_MODEL_PATH` | Absolute path to model dir, or path to `model.json`. Overrides default lookup. |
| `RUNTIME_MODEL` | Model ID under `models/` (default: `student-v2.8-slice-batch`). Falls back to `student-v2.2` if invalid. |
| `ML_REQUIRED` | Set to `1` to fail startup if no real model loads (no noop/dev). |

### Runtime model path

1. If `VNEXT_MODEL_PATH` is set and points to a valid TFJS layers `model.json`, that dir is used.
2. Else: `process.cwd()/models/{RUNTIME_MODEL}/model.json` or fallback `models/student-v2.2/model.json`.

### Render filesystem layout

```
/opt/render/project/src/
├── models/student-v2.2/
│   ├── model.json
│   ├── group1-shard1of1.bin
│   └── metadata.json
├── dist/vnext/vnext/
│   ├── api/compose.js
│   ├── explainer/
│   │   ├── atoms-generator.js
│   │   ├── text-realizer.js
│   │   └── mapping-tables-v1.json   ← copied at build
│   └── ml/index.js
└── server/index.js
```

`mapping-tables-v1.json` is copied into `dist/vnext/vnext/explainer/` by `npm run vnext:build` (via `scripts/copy-vnext-assets.js`).

### Verify ML status

```bash
curl http://localhost:3000/api/ml-status
# Expect: tf_backend != noop, model_sha != dev
```

## Health Checks

### Application Health
```bash
curl http://localhost:3000/readyz
```

### Individual Service Health
```bash
# Audio model
curl http://localhost:3000/api/compose -X POST -d '{"mode":"transit","seed":123}'

# Compatibility service
curl http://localhost:3000/api/compat/health

# Visualization engine
curl http://localhost:3000/readyz | jq '.checks.viz_engine_loaded'
```

## Monitoring

### Key Metrics
- `compose_latency_ms` - P95 < 1.5s
- `compat_search_latency_ms` - P95 < 500ms
- `viz_init_ms` - P95 < 15ms
- `viz_fps_avg` - > 55 FPS
- `4xx_error_rate` - < 1%
- `5xx_error_rate` - < 0.1%

### Alerts
- Rate limit spikes (`RATE_LIMITED` > 10/min)
- CSRF failures (`CSRF_FAILED` > 5/min)
- Missing requestId in logs
- Determinism failures
- CDN header mismatches

## Troubleshooting

### Common Issues

#### 1. Composition Timeout
```bash
# Check model loading
curl http://localhost:3000/readyz | jq '.checks'

# Check logs for model errors
grep "model" logs/app.log | tail -20
```

#### 2. Rate Limit False Positives (including /api/compose 429)
```bash
# Check 429s for /api/compose (log line: route=/api/compose key= limit= remaining= resetMs=)
grep "route=/api/compose" logs/app.log | tail -10

# Check rate limit buckets
grep "RATE_LIMITED" logs/app.log | tail -10

# Reset rate limits (restart required)
pkill -f "npm start"
npm start
```
For local soak without 429, see **Run soak locally (zero 429)** above: start backend with `NODE_ENV=development` and `DISABLE_RATE_LIMIT=1` or `SOAK_MODE=1` or `COMPOSE_RPM=72`.

#### 3. CSRF Token Issues
```bash
# Check CSRF token generation
grep "CSRF_FAILED" logs/app.log | tail -10

# Verify cookie settings
curl -I http://localhost:3000/api/compose
```

#### 4. Visualization Engine Issues
```bash
# Check feature flag
curl http://localhost:3000/readyz | jq '.checks.viz_engine_loaded'

# Disable if needed
export ENABLE_VIZ_ENGINE=false
```

### Log Analysis

#### Request Tracing
```bash
# Find request by ID
grep "requestId=req_1234567890" logs/app.log

# Check error patterns
grep "error.code" logs/app.log | sort | uniq -c
```

#### Performance Analysis
```bash
# Slow compositions
grep "compose_latency_ms" logs/app.log | awk '$2 > 2000'

# High error rates
grep "4xx\|5xx" logs/app.log | awk '{print $1}' | sort | uniq -c
```

## Deployment

### Pre-deployment Checklist
- [ ] Endpoint matrix validation passes
- [ ] All tests pass
- [ ] No dead calls or orphans
- [ ] Standard error schema applied
- [ ] Determinism verified
- [ ] CDN headers correct

### Post-deployment Verification
```bash
# Run endpoint validation
./scripts/validate-endpoints.ps1

# Check health
curl http://localhost:3000/readyz

# Test composition
curl -X POST http://localhost:3000/api/compose \
  -H "Content-Type: application/json" \
  -d '{"mode":"transit","seed":123}'
```

## Security

### CSRF Token Rotation
```bash
# Rotate on login
# Update session with new CSRF token
# Clear old tokens
```

### Rate Limit Tuning
```bash
# Monitor abuse patterns
grep "RATE_LIMITED" logs/app.log | tail -100

# /api/compose 429s (log line includes key, limit, remaining, resetMs)
grep "route=/api/compose" logs/app.log | grep "limit="

# Dev only: disable compose limit (DISABLE_RATE_LIMIT=1 or SOAK_MODE=1) or set COMPOSE_RPM (e.g. 72).
# See "Run soak locally (zero 429)" in this runbook.
```

### Origin Validation
```bash
# Check allowed origins
grep "origin" logs/app.log | tail -20

# Update CORS settings if needed
```

## Backup & Recovery

### Database Backup
```bash
# Export user data
# Backup composition cache
# Save rate limit state
```

### Configuration Backup
```bash
# Backup environment variables
# Save feature flags
# Document model versions
```

## Performance Tuning

### Cache Optimization
```bash
# Check cache hit rates
grep "cache" logs/app.log | tail -20

# Adjust cache TTL
# Update cache keys
```

### Model Optimization
```bash
# Monitor model loading times
grep "model" logs/app.log | tail -20

# Optimize model initialization
# Update model versions
```

## Contact Information

### On-Call Rotation
- Primary: [Contact Info]
- Secondary: [Contact Info]
- Escalation: [Contact Info]

### External Dependencies
- CDN: [Contact Info]
- Model Hosting: [Contact Info]
- Monitoring: [Contact Info]
