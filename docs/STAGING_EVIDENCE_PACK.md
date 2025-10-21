# Staging Evidence Pack

## Required Evidence Collection

### 1. HAR Files (3 golden charts)
- **File**: `staging-golden-chart-1.har`
- **Content**: Compose request + audio GET request
- **Chart**: New York 1990-01-01 12:00
- **Expected**: 200 responses, audio URL accessible

- **File**: `staging-golden-chart-2.har`  
- **Content**: Compose request + audio GET request
- **Chart**: Los Angeles 1985-06-15 18:30
- **Expected**: 200 responses, audio URL accessible

- **File**: `staging-golden-chart-3.har`
- **Content**: Compose request + audio GET request  
- **Chart**: London 1992-12-25 09:15
- **Expected**: 200 responses, audio URL accessible

### 2. Screenshots with Visible Hashes
- **File**: `staging-desktop-chrome.png`
- **Content**: Full browser window showing controlHash and rendererHash
- **Browser**: Chrome (Latest)
- **Chart**: New York 1990-01-01 12:00

- **File**: `staging-mobile-ios.png`
- **Content**: Full screen showing controlHash and rendererHash
- **Browser**: iOS Safari
- **Chart**: New York 1990-01-01 12:00

### 3. Telemetry Snapshot
```json
{
  "timestamp": "2025-10-21T12:00:00Z",
  "environment": "staging",
  "test_run": "frontend-av-validation",
  "metrics": {
    "compose_latency_ms": {
      "p50": 85.2,
      "p95": 120.5,
      "max": 150.0
    },
    "audio_startup_ms": {
      "p50": 45.1,
      "p95": 80.3,
      "max": 100.0
    },
    "fallback_rate": 0.0,
    "error_rate": 0.0,
    "success_rate": 100.0
  },
  "hashes": {
    "control": "sha256:7ba3cf9b67c4e6acb14efb247749f425426a7531f7c4f719a41d60b51465c40d",
    "audio": "sha256:b88e5d7044a6d2dc99df2eedfbd96fbb7479a5e245dd7c190223339fe4335ffb",
    "explanation": "sha256:63525667c65d49438e3148b68732d82803357e999a026ec7814d02a48da3ec7f"
  }
}
```

### 4. Rate Limit Proof
- **File**: `staging-rate-limit-429.txt`
- **Content**: 429 Too Many Requests response
- **Method**: 15 rapid requests to /api/compose
- **Expected**: HTTP 429 with retryAfter header

### 5. Fail-Closed Proof  
- **File**: `staging-fail-closed-400.txt`
- **Content**: 400 Bad Request response
- **Input**: Invalid date "invalid-date"
- **Expected**: HTTP 400 with validation error details

## Evidence Collection Script

```powershell
# Run staging validation and collect evidence
.\scripts\staging-validation.ps1 -StagingUrl "https://staging.astradio.io" -TestCount 10

# Collect HAR files (manual in browser DevTools)
# 1. Open DevTools → Network tab
# 2. Run 3 golden charts
# 3. Right-click → Save all as HAR
# 4. Rename to staging-golden-chart-*.har

# Collect screenshots (manual)
# 1. Desktop: Full browser window with visible hashes
# 2. Mobile: Full screen with visible hashes
# 3. Error state: Error message visible

# Collect telemetry (from validation script output)
# Copy metrics from console output to telemetry.json
```

## Validation Checklist

### ✅ Required Evidence
- [ ] 3 HAR files (compose + audio requests)
- [ ] 2 Screenshots (desktop + mobile) with visible hashes
- [ ] Telemetry snapshot with latency metrics
- [ ] Rate limit proof (429 response)
- [ ] Fail-closed proof (400 response)

### ✅ Quality Checks
- [ ] All HAR files show 200 responses
- [ ] Screenshots show controlHash and rendererHash
- [ ] Telemetry shows reasonable latency (P95 < 200ms)
- [ ] Rate limiting works (429 after 10+ requests)
- [ ] Error states fail closed (no fallback rendering)

## Acceptance Criteria

**Pass**: All evidence collected, quality checks passed
**Fail**: Missing evidence, quality checks failed, or critical regressions

## File Naming Convention

```
staging-{type}-{identifier}.{extension}
- staging-golden-chart-1.har
- staging-desktop-chrome.png  
- staging-mobile-ios.png
- staging-rate-limit-429.txt
- staging-fail-closed-400.txt
- staging-telemetry.json
```
