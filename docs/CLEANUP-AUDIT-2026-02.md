# Repo cleanup audit (Feb 2026)

One-time removal of extraneous/redundant files. **No pipeline code was changed.**

## Removed

### Duplicate / copy directories
- **Astradio_VNEXT/** — Full copy of vnext + server; redundant with root `vnext/` and `server/`.
- **soak-only-repo/** — Standalone soak repo (own package, evidence, scripts); main repo has `scripts/soak-runner.js` and `artifacts/soak/`.
- **api/** — Legacy `api/swiss.js`; server uses `swisseph` directly.
- **Backend/** — Legacy `Backend/server.js`; duplicate of `server/`.
- **quarantine/** — Single manifest file; one-off.

### Root junk / generated
- **tr phase-3-final-clean**, **utputFormat** — Typo/junk filenames.
- **.client_calls.txt**, **.express_routes.txt**, **.next_routes.txt** — Route dump artifacts.
- **payload.json**, **extract-telemetry.js**, **compose-buenosaires.json**, **compose-mexico.json** — One-off telemetry/sample payloads.
- **det_norm_1.json** … **det_norm_5.json** — Old determinism test outputs (duplicates of artifacts).
- **e-4-d-series-v2.4-candidate...** — Typo filename.
- **train-v2.1.sh** — Superseded by `vnext/scripts/train-v2.4.ts`.
- **canary-config.json** — Unreferenced.

### Root one-off docs (audits/snapshots)
- AUDIO-IMPLEMENTATION-SUMMARY.md, CODE-REVIEW-SNIPPETS.md, COMPREHENSIVE-AUDIT.md  
- FIX-STALE-COMPILED-FILES.md, SOAK-LOAD-AUDIT-REPORT.md, SOAK-README.md  
- STAGING-ONLY.md, STARTUP-AUDIT.md, SYNC-SUMMARY.md, SYSTEM-ARCHITECTURE-DIAGRAM.md  
- v2.7-EVIDENCE-SOAK.md, BETA-READINESS-EVIDENCE.md, BETA-T0-EVIDENCE.md, CLEANUP-SUMMARY.md  

### Artifacts
- **artifacts/post-js-retire/**, **artifacts/pre-js-retire/** — Old determinism test run outputs.
- **artifacts/DIFF_OK.txt** — One-off diff artifact.

**Kept:** `artifacts/soak/golden-charts.json` (used by `scripts/soak-runner.js`).

## Untouched (pipeline and supporting)

- **server/**, **apps/**, **vnext/**, **lib/**, **models/**, **workers/**, **routes/**, **services/**, **tests/**
- **config/**, **configs/**, **data/**, **datasets/**, **design/**, **splits/**, **slices/**, **types/**
- **proofs/**, **hashes/**, **evals/**, **eval/**, **exports/**, **dev/** (includes a11y-check.js used by scripts)
- **docs/** (all remaining), **.github/**, **.devcontainer/**
- Root: **test-determinism.ps1**, **test-quality-gates.ps1**, **e2e-test.ps1**, **README.md**, **env.example**, configs, lockfiles
