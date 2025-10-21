# 24-Hour Staging Soak Documentation

## Overview

The 24-hour staging soak is a fully automated validation system that continuously monitors staging environment health and API performance. It runs hourly for 24 hours, testing the compose API with a deterministic golden chart set and validating performance thresholds.

## Architecture

- **Single Engine**: Next.js → Express → vNext (one observable compose path)
- **Spec Pinning**: UnifiedSpecV1.1 required, fail-closed on mismatch
- **Evidence-First**: JSONL logs + HAR capture on failures
- **No New Features**: Only validation, no product changes

## Components

### 1. GitHub Actions Workflow (`.github/workflows/soak-24h.yml`)
- **Triggers**: Manual (`workflow_dispatch`) and scheduled (`0 * * * *`)
- **Concurrency**: Prevents overlapping runs
- **Timeout**: 5 minutes per run
- **Environment**: Ubuntu latest with Node.js 20.12.2

### 2. Soak Runner (`scripts/soak-runner.js`)
- **Health Checks**: `/health` and `/readyz` endpoints
- **Golden Charts**: 20 deterministic test cases
- **Determinism**: Back-to-back identical requests
- **Rate Limiting**: ≤1 RPS to be staging-friendly
- **Evidence Collection**: JSONL + HAR on failures

### 3. Summary Generator (`scripts/soak-summary.js`)
- **Hourly Reports**: Real-time status updates
- **24-Hour Analysis**: Full trend analysis and recommendations
- **Threshold Validation**: Automated pass/fail determination
- **ASCII Trends**: Visual performance indicators

### 4. Golden Charts (`artifacts/soak/golden-charts.json`)
- **20 Test Cases**: Global locations, various dates/times
- **Deterministic**: Same input → same output requirement
- **Coverage**: Different timezones, seasons, astrological configurations

## Configuration

### Environment Variables
```bash
STAGING_BASE_URL=https://staging.astradio.io  # Target staging URL
STAGING_AUTH_HEADER=Bearer token123           # Optional auth header
```

### Thresholds
- **Error Rate**: ≤1% (fails job if exceeded)
- **Fallback Rate**: ≤2% (fails job if exceeded)  
- **Compose P95**: ≤1800ms (fails job if exceeded)
- **Audio P95**: ≤2500ms (fails job if exceeded)
- **Determinism**: 100% pass rate (fails job if any failures)

## Evidence Collection

### JSONL Format
Each test result is logged as a JSONL entry:
```
2024-01-15T10:00:00.000Z {"timestamp":"2024-01-15T10:00:00.000Z","chart_id":"golden-001","success":true,"spec":"UnifiedSpecV1.1","controlHash":"sha256:abc123","audioUrl":"/api/audio/abc123.mp3","composeLatencyMs":1200,"audioStartupMs":800,"fallbackUsed":false}
```

### HAR Files
Failure cases are saved as HAR (HTTP Archive) files:
- **Location**: `artifacts_EVIDENCE_DIR/hars/`
- **Format**: JSON with request/response/error details
- **Trigger**: Any failure (HTTP error, spec mismatch, missing fields)

## Validation Criteria

### ✅ Pass Criteria
- **Health Endpoints**: `/health` and `/readyz` both responding
- **Golden Charts**: 100% success rate across all 20 charts
- **Spec Compliance**: All responses use UnifiedSpecV1.1
- **Audio URLs**: Non-null, accessible audio URLs
- **Determinism**: Identical requests produce identical outputs
- **Thresholds**: All performance thresholds met

### ❌ Fail Criteria
- Any health endpoint failure
- Any golden chart failure
- Spec version mismatch
- Missing control/renderer hashes
- Missing audio URLs
- Determinism failures
- Threshold breaches

## Determinism Testing

Each hour, one chart is tested twice back-to-back:
- **Chart**: First golden chart (golden-001)
- **Timing**: 100ms delay between requests
- **Validation**: 
  - **Control Hash**: Identical across runs
  - **Renderer Hash**: Identical across runs  
  - **Audio URL**: Identical across runs
  - **Spec Version**: UnifiedSpecV1.1

## Monitoring & Alerting

### GitHub Actions Integration
- **Job Summaries**: Hourly status posted to Actions summary
- **Artifact Upload**: Evidence retained for 30 days
- **Issue Creation**: Automatic issue on failure with diagnostics

### Failure Response
When thresholds are breached:
1. **Job Fails**: Workflow exits with error code
2. **Issue Created**: GitHub issue with failure details
3. **Artifacts Saved**: Full evidence preserved
4. **Summary Generated**: Diagnostic report attached

## Artifacts Structure

```
artifacts/soak/
├── soak-evidence.jsonl          # All test results (JSONL)
├── SOAK-REPORT.md              # 24-hour summary report
├── golden-charts.json          # Test dataset
└── hars/                       # Failure HAR files
    ├── failure-golden-001-1642248000000.json
    └── failure-golden-002-1642251600000.json
```

## Usage

### Manual Start
```bash
# Via GitHub Actions UI
Actions → 24-Hour Staging Soak → Run workflow
# Set STAGING_BASE_URL and optional STAGING_AUTH_HEADER
```

### Local Testing
```bash
# Set environment variables
export STAGING_BASE_URL=https://staging.astradio.io
export STAGING_AUTH_HEADER="Bearer your-token"

# Run soak test
node scripts/soak-runner.js

# Generate summary
node scripts/soak-summary.js
```

### Monitoring
```bash
# Check evidence in real-time
tail -f artifacts/soak/soak-evidence.jsonl

# View latest report
cat artifacts/soak/SOAK-REPORT.md
```

## Troubleshooting

### Common Issues

#### Health Check Failures
- **Symptom**: `/health` or `/readyz` endpoints failing
- **Cause**: Staging environment down or misconfigured
- **Action**: Check staging deployment and infrastructure

#### Spec Mismatch
- **Symptom**: Responses not using UnifiedSpecV1.1
- **Cause**: Engine version mismatch or configuration error
- **Action**: Verify staging is running correct engine version

#### Determinism Failures
- **Symptom**: Identical requests producing different outputs
- **Cause**: Non-deterministic behavior in compose pipeline
- **Action**: Review caching, random seeds, and model consistency

#### Threshold Breaches
- **Symptom**: P95 latencies exceeding budgets
- **Cause**: Performance degradation or resource constraints
- **Action**: Review staging infrastructure and optimize compose pipeline

### Debugging

#### Check Evidence
```bash
# View recent failures
grep '"success":false' artifacts/soak/soak-evidence.jsonl | tail -10

# Analyze error patterns
grep '"errorCode"' artifacts/soak/soak-evidence.jsonl | cut -d'"' -f4 | sort | uniq -c
```

#### Review HAR Files
```bash
# List failure captures
ls -la artifacts/soak/hars/

# Examine specific failure
cat artifacts/soak/hars/failure-golden-001-*.json | jq '.error'
```

## Integration

### CI/CD Pipeline
The soak integrates with the existing CI/CD pipeline:
- **Pre-deploy**: Run soak validation before staging deployment
- **Post-deploy**: Verify staging health after deployment
- **Continuous**: Hourly monitoring during staging phase

### Beta Handoff
When soak passes 24-hour validation:
1. **Evidence Package**: Complete JSONL + HAR + reports
2. **Performance Metrics**: P50/P95 latencies, error rates
3. **Determinism Proof**: Consistent outputs across runs
4. **Recommendations**: Next steps for beta launch

## Maintenance

### Golden Chart Updates
- **Location**: `artifacts/soak/golden-charts.json`
- **Process**: Update test cases as needed
- **Validation**: Ensure determinism maintained

### Threshold Tuning
- **Location**: `scripts/soak-runner.js` CONFIG.thresholds
- **Process**: Adjust based on performance requirements
- **Impact**: Affects pass/fail criteria

### Monitoring Improvements
- **Metrics**: Add new performance indicators
- **Alerting**: Enhance failure notifications
- **Reporting**: Improve trend analysis

---

*For questions or issues, check the GitHub Actions workflow logs and artifacts, or review the evidence files for detailed diagnostics.*