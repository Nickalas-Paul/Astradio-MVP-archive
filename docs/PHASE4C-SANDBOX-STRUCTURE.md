# Phase 4C: Sandbox Environment Structuring

## Overview

Phase 4C establishes a stable, deterministic sandbox environment with explicit state management, deterministic override semantics, and network hardening. The sandbox follows a strict data flow: birth data → base snapshot → overrides → overridden snapshot → report.

## State Machine

The sandbox builder implements an explicit state machine with the following states:

- **`idle`**: Initial state, no birth data loaded
- **`loading_base`**: Loading base snapshot from birth data
- **`ready_builder`**: Base snapshot loaded, ready for overrides
- **`syncing_overrides`**: Applying overrides, awaiting overridden snapshot
- **`ready_report`**: Overridden snapshot stable, ready for report generation
- **`generating_report`**: Generating report from overridden snapshot
- **`report_ready`**: Report generated and available
- **`error`**: Error state, user can reset

## Data Flow

```
Birth Data → baseSnapshot (immutable)
           ↓
        overrides (mutable)
           ↓
    overriddenSnapshot (derived from API)
           ↓
         report (derived from report API)
```

### Invariants

1. **Birth is canonical base**: `baseSnapshot` is immutable after load
2. **Overrides are the only mutable layer**: Changes only affect `overrides` object
3. **Overridden snapshot is derived**: Never mutated directly, always from `/api/sandbox/snapshot`
4. **Report comes from overridden snapshot**: Always generated via `/api/sandbox/report` using current overridden snapshot

## Deterministic Override Semantics

### Degree Precision

All degree values are normalized to **0.1° precision** for determinism:

- Wheel drag: `roundDegree(lonDeg)` → `Math.round(lonDeg * 10) / 10`
- DegreePanel input: Same rounding on change
- Backend hashing: `lonDeg.toFixed(1)` in `hashOverrides()`

### Sorted Planet Keys

Overrides payloads always use **sorted planet keys** for deterministic hashing:

```typescript
function normalizeOverrides(overrides: SandboxOverrides): SandboxOverrides {
  const sortedPlanets: Partial<Record<PlanetKey, { lonDeg: number }>> = {};
  const planetKeys = Object.keys(overrides.planets || {}) as PlanetKey[];
  planetKeys.sort((a, b) => a.localeCompare(b));
  
  for (const key of planetKeys) {
    const override = overrides.planets[key];
    if (override) {
      sortedPlanets[key] = { lonDeg: roundDegree(override.lonDeg) };
    }
  }
  
  return { planets: sortedPlanets, angles: overrides.angles };
}
```

### Consistent Display

UI always displays derived sign + degree + minutes consistently from `lonDeg`:

```typescript
function lonToSignDeg(lonDeg: number): { sign: string; deg: number; min: number } {
  const signIdx = Math.floor(lonDeg / 30);
  const degInSign = lonDeg % 30;
  const deg = Math.floor(degInSign);
  const min = Math.round((degInSign - deg) * 60);
  return {
    sign: SIGN_NAMES[signIdx % 12],
    deg,
    min,
  };
}
```

## Network Hardening

### Snapshot Updates

- **Debounce**: 300ms delay before network request
- **Sequence IDs**: Each request gets a unique sequence ID
- **AbortController**: Prior in-flight request aborted on new change
- **Response validation**: Only apply response if it matches latest sequence ID

```typescript
const sequenceId = ++snapshotSequenceRef.current;
// ... debounced fetch ...
if (sequenceId !== snapshotSequenceRef.current) {
  return; // Outdated response, ignore
}
```

### Report Generation

- **AbortController**: Prior report request aborted if overrides change before completion
- **Sequence IDs**: Track report requests to ignore outdated responses
- **Hash matching**: Report results tied to `combinedHash` used to generate them

### Loading Indicators

- **`syncing_overrides`**: Shows "Syncing overrides..." indicator
- **`generating_report`**: Shows "Generating report..." indicator

## Reset Behaviors

### Reset All Overrides

Returns to `ready_builder` state with:
- `overrides` → `{ planets: {} }`
- `overriddenSnapshot` → `baseSnapshot`
- Triggers network update to sync state

### Reset One Planet

Removes that planet's override only:
- `delete overrides.planets[planet]`
- Updates `overriddenSnapshot` optimistically
- Triggers debounced network update

## Verification

### Running Verification

```bash
# Build vnext
npm run vnext:build

# Start engine (Terminal 1)
PORT=4000 node server/index.js
# Or on Windows PowerShell:
$env:PORT=4000; node server/index.js

# Run verification (Terminal 2)
# Defaults to http://localhost:4000, or set API_BASE_URL:
npm run verify:phase4c
# Or explicitly:
# Windows PowerShell:
$env:API_BASE_URL="http://localhost:4000"; node dist/vnext/vnext/scripts/phase4c-sandbox-verification.js
# Unix/Mac:
API_BASE_URL=http://localhost:4000 node dist/vnext/vnext/scripts/phase4c-sandbox-verification.js
```

### Test Cases

**Case 1: Fixed birth + empty overrides (3 runs)**
- Verifies identical `SNAPSHOT_CHECKSUM` and `REPORT_CHECKSUM` across runs
- Ensures base snapshot determinism

**Case 2: Fixed birth + fixed overrides (Sun=123.4, Moon=210.0) (3 runs)**
- Verifies identical checksums with fixed overrides
- Ensures override application determinism

**Case 3: Fixed birth + sequential overrides (Sun=0.0 → 0.1 → 0.2 → 0.3)**
- Verifies checksum changes each step
- Verifies each step is stable across repeats
- Ensures 0.1° precision affects hashing correctly

### Expected Output

```
Phase 4C: Sandbox Environment Structuring Verification
API_BASE_URL: http://localhost:4000

[PRECONDITION] Verifying endpoints...
  ✓ Endpoints available

[CASE 1] Fixed birth + empty overrides (3 runs)
  Run 1: snapshot=a80cb657635ea59f... report=a80cb657635ea59f...
  Run 2: snapshot=a80cb657635ea59f... report=a80cb657635ea59f...
  Run 3: snapshot=a80cb657635ea59f... report=a80cb657635ea59f...
  ✓ PASS: snapshot=a80cb657635ea59f... report=a80cb657635ea59f...

[CASE 2] Fixed birth + fixed overrides (Sun=123.4, Moon=210.0) (3 runs)
  Run 1: snapshot=2592f82bfb422bb3... report=2592f82bfb422bb3...
  Run 2: snapshot=2592f82bfb422bb3... report=2592f82bfb422bb3...
  Run 3: snapshot=2592f82bfb422bb3... report=2592f82bfb422bb3...
  ✓ PASS: snapshot=2592f82bfb422bb3... report=2592f82bfb422bb3...

[CASE 3] Fixed birth + sequential overrides (Sun=0.0 -> 0.1 -> 0.2 -> 0.3)
  Sun=0.0°: 705108b73b8cb2e5...
  Sun=0.1°: 274c05d5934f6164...
  Sun=0.2°: 71ea49b055db0f06...
  Sun=0.3°: 93fb8c15c59019ed...
  ✓ PASS: Checksums change per step, stable per step

=== VERIFICATION RESULTS ===
CASE1_SNAPSHOT_CHECKSUM=a80cb657635ea59fea5b4319b5b5f1e1c8af416c15b826ecc944c5ed140250d6
CASE1_REPORT_CHECKSUM=a80cb657635ea59fea5b4319b5b5f1e1c8af416c15b826ecc944c5ed140250d6
CASE2_SNAPSHOT_CHECKSUM=2592f82bfb422bb38dbb012cf1f0874140bea16747161d50f6dfeea2cf3f879b
CASE2_REPORT_CHECKSUM=2592f82bfb422bb38dbb012cf1f0874140bea16747161d50f6dfeea2cf3f879b
CASE3_CHECKSUMS=705108b73b8cb2e547bf2cbbb67e9c2b35684acf72e9210b00ef90ad00e1d986,274c05d5934f61642c71062bb9942a6a6fed531384e295bfe27a4e3e45d70624,71ea49b055db0f0612ebe937b1ed9823d59257881ba954fe076f10a0b8cbfc41,93fb8c15c59019ed96cb4a7937a026da75f92b3278cc2f886c937c7e52aa33de

VERIFICATION=PASS
```

### Recorded Checksums (2026-02-17)

These checksums verify deterministic behavior:

- **Case 1 (empty overrides)**: Both snapshot and report produce identical checksum `a80cb657635ea59fea5b4319b5b5f1e1c8af416c15b826ecc944c5ed140250d6` across 3 runs
- **Case 2 (fixed overrides)**: Both snapshot and report produce identical checksum `2592f82bfb422bb38dbb012cf1f0874140bea16747161d50f6dfeea2cf3f879b` across 3 runs
- **Case 3 (sequential overrides)**: Each step produces a unique, stable checksum:
  - Sun=0.0°: `705108b73b8cb2e547bf2cbbb67e9c2b35684acf72e9210b00ef90ad00e1d986`
  - Sun=0.1°: `274c05d5934f61642c71062bb9942a6a6fed531384e295bfe27a4e3e45d70624`
  - Sun=0.2°: `71ea49b055db0f0612ebe937b1ed9823d59257881ba954fe076f10a0b8cbfc41`
  - Sun=0.3°: `93fb8c15c59019ed96cb4a7937a026da75f92b3278cc2f886c937c7e52aa33de`

## Implementation Files

### Frontend

- `apps/web/app/sandbox/builder/page.tsx` - Main builder page with state machine
- `apps/web/src/components/sandbox/DegreePanel.tsx` - Degree input with 0.1° rounding
- `apps/web/src/components/sandbox/WheelCanvasBuilder.tsx` - Wheel drag with 0.1° rounding
- `apps/web/src/types/sandbox.ts` - Type definitions

### Backend

- `vnext/api/sandbox-routes.ts` - API routes (`/api/sandbox/snapshot`, `/api/sandbox/report`)
- `vnext/api/sandbox-snapshot.ts` - Snapshot generation with sorted keys and 0.1° rounding

### Verification

- `vnext/scripts/phase4c-sandbox-verification.ts` - Determinism verification script

## Contracts

### No Compose/Music/Gates

The sandbox environment **does not** use:
- `/api/compose` endpoint
- Music generation
- Gate logic

All reports come from `architecture-engine` via `/api/sandbox/report` only.

### API Endpoints

**POST `/api/sandbox/snapshot`**
- Input: `{ birth: SandboxBirth, overrides: SandboxOverrides }`
- Output: `{ snapshot: EphemerisSnapshot, meta: { baseHash, overridesHash, combinedHash } }`

**POST `/api/sandbox/report`**
- Input: `{ birth: SandboxBirth, overrides: SandboxOverrides, seed?: string }`
- Output: `{ features, personality, guidance, explanation, seed, meta: { combinedHash } }`

## Notes

- All degree values normalized to 0.1° precision before hashing
- Planet keys sorted alphabetically in override payloads
- AbortController prevents race conditions from rapid user input
- Sequence IDs ensure only latest responses are applied
- State machine makes UI behavior explicit and debuggable
