# Phase 1 TypeScript Build Fixes

**Date:** 2026-02-15  
**Purpose:** Fix TypeScript build errors introduced during Phase 1 verification

---

## Changes Made

### 1. Fixed GateReport Type in `vnext/api/personality.ts`

**Issue:** GateReport stub did not match the exact type definition in `vnext/explainer/contracts.ts`.

**Error:** Type mismatch - `scores` included `overall` (not in type) and `latency_ms` was a number instead of an object.

**Fix Applied:**
- Removed `overall` from `scores` object (GateReport.scores only has: melody_arc, melody_step_leap, melody_narrative, rhythm_diversity)
- Changed `latency_ms` from `0` to `{ predict: 0, plan: 0, total: 0 }` to match type definition
- Reordered `calibrated` and `strict` properties to match type order (overall last)

**Code Change:**
```typescript
// Before:
const gateReportStub: GateReport = {
  calibrated: { overall: true, melody_arc: true, ... },
  strict: { overall: true },
  scores: { ..., overall: 1.0 },  // ❌ overall not in type
  latency_ms: 0  // ❌ should be object
};

// After:
const gateReportStub: GateReport = {
  calibrated: {
    melody_arc: true,
    melody_step_leap: true,
    melody_narrative: true,
    rhythm_diversity: true,
    overall: true
  },
  strict: {
    melody_arc: true,
    melody_step_leap: true,
    melody_narrative: true,
    rhythm_diversity: true,
    overall: true
  },
  scores: {
    melody_arc: 1.0,
    melody_step_leap: 1.0,
    melody_narrative: 1.0,
    rhythm_diversity: 1.0
    // ✅ No overall in scores
  },
  latency_ms: {
    predict: 0,
    plan: 0,
    total: 0
  }
};
```

**File:** `vnext/api/personality.ts` (lines 87-106)

---

### 2. Fixed Chart Type Import in `vnext/compat/matches.ts`

**Issue:** `storage.Chart` type annotation - namespace `vnext/compat/storage` has no exported member `Chart`.

**Error:** TypeScript could not find `Chart` type in storage namespace.

**Fix Applied:**
- Added import: `import type { Chart } from './types';`
- Changed function parameter type from `storage.Chart` to `Chart`

**Code Change:**
```typescript
// Before:
import * as storage from './storage';

function toVec64(chart: storage.Chart): Promise<Float32Array | number[]> {
  // ...
}

// After:
import * as storage from './storage';
import type { Chart } from './types';

function toVec64(chart: Chart): Promise<Float32Array | number[]> {
  // ...
}
```

**File:** `vnext/compat/matches.ts` (lines 7-26)

**Note:** Runtime logic unchanged - only type annotation fixed.

---

### 3. Fixed Module Scoping in Script Files

**Issue:** Script files had global scope collisions on `BASE`/`BASE_URL` and `main` function names.

**Error:** Duplicate identifier errors when TypeScript treats scripts as global scope.

**Fix Applied:**
- Added `export {};` at the top of each script file to ensure ES module scope
- Files fixed:
  - `vnext/scripts/e2e-compose-tests.ts`
  - `vnext/scripts/verify-community-search.ts`
  - `vnext/scripts/verify-profile-compat.ts`

**Code Change:**
```typescript
// Before:
// vnext/scripts/e2e-compose-tests.ts
// Consolidated E2E runner...

type Json = Record<string, any>;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// After:
// vnext/scripts/e2e-compose-tests.ts
// Consolidated E2E runner...

export {}; // Ensure module scope

type Json = Record<string, any>;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
```

**Files:**
- `vnext/scripts/e2e-compose-tests.ts` (line 3)
- `vnext/scripts/verify-community-search.ts` (line 8)
- `vnext/scripts/verify-profile-compat.ts` (line 9)

**Note:** No function renaming required - module scope prevents collisions.

---

## Verification

### Build Status: ✅ **PASSING**

**Command:**
```bash
npm run vnext:build
```

**Result:** 0 TypeScript errors

---

## Summary

| Issue | File | Fix | Status |
|-------|------|-----|--------|
| GateReport type mismatch | `vnext/api/personality.ts` | Fixed stub to match exact type (no overall in scores, latency_ms object) | ✅ Fixed |
| Chart type import | `vnext/compat/matches.ts` | Import Chart from `./types` instead of `storage` namespace | ✅ Fixed |
| Module scoping | `vnext/scripts/e2e-compose-tests.ts` | Added `export {}` | ✅ Fixed |
| Module scoping | `vnext/scripts/verify-community-search.ts` | Added `export {}` | ✅ Fixed |
| Module scoping | `vnext/scripts/verify-profile-compat.ts` | Added `export {}` | ✅ Fixed |

---

## Constraints Maintained

- ✅ No changes to compose behavior or determinism
- ✅ No music coupling reintroduced into personality API
- ✅ Phase 1 architecture-engine consolidation intact
- ✅ Only typings and module scope fixes (no runtime changes)

---

**Build Status:** ✅ **0 TypeScript Errors**
