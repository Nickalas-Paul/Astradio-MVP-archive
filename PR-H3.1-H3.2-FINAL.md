# PR-H3.1/H3.2-Final: Legacy JS Retirement Complete

## Summary
Successfully retired legacy JavaScript sources for users and library modules, enforcing TypeScript-first loading with runtime from `dist/` only.

## Changes Made

### Legacy JS Retirement
- **Quarantined Files**:
  - `routes/users.js` → `legacy_quarantine/routes/users.js.disabled`
  - `routes/library.js` → `legacy_quarantine/routes/library.js.disabled`
- **Import Hardening**: Updated `server/index.js` to use compiled TypeScript routes via `optionalRequire()`
- **Runtime Hygiene**: Created `scripts/ci-runtime-hygiene.js` for automated enforcement

### Files Modified
- `server/index.js` - Updated route imports to use compiled TypeScript versions
- `scripts/ci-runtime-hygiene.js` - New CI guardrail for runtime hygiene
- `legacy_quarantine/` - New directory containing quarantined legacy files

## Verification Results

### ✅ No Runtime Loadable JS Sources Left
- **0** source `.js` imports found in runtime code
- Server uses compiled TypeScript routes via `optionalRequire()`
- All imports resolve to `dist/routes/*.js` compiled files

### ✅ Quarantine is Sealed
- Legacy files quarantined with `.disabled` suffix
- **0** references to `legacy_quarantine/` directory
- Node cannot accidentally load quarantined files

### ✅ Runtime Hygiene CI Gate
- **45** runtime JS files scanned
- **0** `.ts` imports in runtime JS
- **0** source `.js` imports outside `dist/`
- **0** `legacy_quarantine` references

### ✅ Pre/Post Parity Confirmed
- **Determinism**: Identical normalized hash
  - `241D69C11E90797D60C62F7F91BEB4614E38D8C64A5909D0FA12D1DDF772A19E`
- **Schema**: All v1.1 keys present (`controls`, `astro`, `gate_report`, `audio`, `text`, `artifacts`)
- **Fail-Closed**: Identical behavior
- **Route Proof**: Identical 410 responses

### ✅ Route Proof (Final)
- `/api/render` → **410 Gone** with deprecation message
- `/api/compose` → All required v1.1 keys present
- Single pipeline enforced: only `/api/compose` generates audio+text

## CI Gates Required
1. **Runtime Hygiene**: `node scripts/ci-runtime-hygiene.js` must pass
2. **Schema Check**: All v1.1 keys present
3. **Determinism Gate**: 5× identical requests → normalized hash match
4. **Fail-Closed Test**: `short=""`, `template_id="v1.fail.00"`, bullets start with "Adjust:"
5. **Route Proof**: `/api/render` → 410 Gone

## Risk Assessment
- **Low Risk**: All changes are reversible via quarantine directory
- **No Breaking Changes**: Identical API surface maintained
- **E2E Verified**: Core compose pipeline unaffected
- **Rollback Plan**: Restore files from `legacy_quarantine/` and revert server imports

## Next Steps
- **H3.3**: Social/sharing modules migration (same pattern)
- **H3.4**: Clean-up and final linting
- **D-series**: Engine uplift planning (v2.4 training + 1k eval)

## Status: ✅ READY FOR MERGE
**TypeScript-first loading with runtime from `dist/` only is now enforced for users and library modules.**
