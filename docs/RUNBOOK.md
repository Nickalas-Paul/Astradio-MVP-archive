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
