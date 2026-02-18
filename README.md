# Astradio VNEXT

Production-ready astrological music generation platform with integrated soak testing and CI/CD.

## Migration Summary

This repository was created as part of a controlled migration from `Astradio_MVP` to establish a clean, production-ready codebase with validated soak testing infrastructure.

### What Was Reused

✅ **Core Soak Infrastructure**:
- `scripts/soak-runner.js` - Production-ready soak runner with comprehensive validation
- `scripts/soak-summary.js` - Advanced reporting with ASCII trends and threshold analysis  
- `artifacts/soak/golden-charts.json` - 20 deterministic test cases covering global locations
- `.github/workflows/soak-24h.yml` - Mature GitHub Actions workflow with proper concurrency control

✅ **Supporting Infrastructure**:
- Health check endpoints (`/health`, `/readyz`)
- Evidence collection (JSONL + HAR files)
- Threshold validation (Error rate ≤1%, Fallback rate ≤2%, Compose P95 ≤1800ms, Audio P95 ≤2500ms)
- Determinism testing with back-to-back requests
- Rate limiting (≤1 RPS) for staging-friendly operation

✅ **CI/CD Integration**:
- `.github/workflows/compose-e2e.yml` - E2E testing workflow
- `.github/workflows/endpoint-validation.yml` - Comprehensive endpoint matrix validation
- Artifact retention (30 days)
- Automatic issue creation on failures

### What Was Eliminated

❌ **Redundant Components**:
- Duplicate `astradio-soak/` directory with redundant documentation
- Standalone soak package that wasn't needed
- Redundant PowerShell scripts not used in main workflow

### Architecture

- **Single Engine**: Next.js → Express → vNext (one observable compose path)
- **Spec Pinning**: UnifiedSpecV1.1 required, fail-closed on mismatch
- **Evidence-First**: JSONL logs + HAR capture on failures
- **No New Features**: Only validation, no product changes

### CI + Soak Relationship

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CI Pipeline   │───▶│  Soak Testing    │───▶│  Beta Handoff   │
│                 │    │                  │    │                 │
│ • Build         │    │ • 24h validation │    │ • Evidence      │
│ • Test          │    │ • Determinism    │    │ • Metrics       │
│ • Deploy        │    │ • Thresholds     │    │ • Reports       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Atomic Commit Policy

Commits are organized by directory scope:
- `engine/` - Core engine changes
- `viz/` - Visualization components  
- `text/` - Text generation components
- `soak/` - Soak testing infrastructure
- `ci/` - CI/CD pipeline changes

### Usage

#### Local Development
```bash
npm install
npm run dev:all
```

This starts both services:
- **Engine** → `http://localhost:4000` (API server)
- **Frontend** → `http://localhost:3000` (Next.js)

To run services separately:
```bash
npm run engine:dev  # Engine only (port 4000)
npm run web:dev      # Frontend only (port 3000)
```

#### Soak Testing
```bash
# Set environment variables
export STAGING_BASE_URL=https://staging.astradio.io
export STAGING_AUTH_HEADER="Bearer your-token"

# Run soak test
node scripts/soak-runner.js

# Generate summary
node scripts/soak-summary.js
```

#### CI Pipeline
The CI pipeline runs automatically on:
- Push to main/develop branches
- Pull requests
- Manual workflow dispatch

## Migration Rationale

The migration was performed to:
1. **Eliminate Redundancy**: Remove duplicate soak infrastructure and documentation
2. **Clean Architecture**: Establish single source of truth for soak testing
3. **Production Ready**: Create clean baseline for production deployment
4. **Maintain History**: Preserve all soak data and evidence in archived repository

## Repository Status

- **Source**: Migrated from `Astradio_MVP` (now archived as `Astradio-MVP-archive`)
- **Soak Status**: Current 24-hour soak continues uninterrupted
- **CI Status**: All workflows validated and operational
- **Evidence**: All historical soak data preserved in archive

---

*For questions or issues, check the GitHub Actions workflow logs and artifacts, or review the evidence files for detailed diagnostics.*