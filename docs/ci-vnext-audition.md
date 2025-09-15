# vNext CI Audition Gate

## Overview
The vNext audition gate ensures ML model quality by running automated tests on every PR that touches vNext code.

## What it does
1. **Builds vNext** - Compiles TypeScript to JavaScript
2. **Materializes snapshots** - Converts input charts to feature vectors  
3. **Runs audition** - Tests ML cascade on real data
4. **Enforces 90% threshold** - Fails if pass rate drops below 90%

## Failure modes
- **Build errors** - TypeScript compilation fails
- **Missing datasets** - No input snapshots found
- **ML cascade failures** - Student/retrieval models fail
- **Quality gate failures** - Plans don't meet minimum standards
- **Pass rate below 90%** - Too many generated plans fail audition

## Local testing
```bash
# Test the same pipeline locally
npm run vnext:build
npm run vnext:materialize  
npm run vnext:audition
```

## Artifacts
On failure, CI uploads:
- `logs/vnext-audit.jsonl` - Detailed audit logs
- `datasets/snapshots.jsonl` - Generated test data

## Threshold tuning
Current threshold: **90% pass rate**
- Adjust in `vnext/scripts/run-audition.ts`
- Consider increasing to 95% as models improve
- Lower temporarily only for major model architecture changes
