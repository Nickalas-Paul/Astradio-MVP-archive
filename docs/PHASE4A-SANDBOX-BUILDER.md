# Phase 4A: Sandbox Birth-Data-First + Drag-and-Drop Degree Placements

## Overview

Sandbox pillar for self-exploration: birth data first → real EphemerisSnapshot → manual planet overrides → deterministic reports. No reverse transforms, no compose/music/gates.

## SandboxDraft Contract

### Type Definitions

```typescript
type PlanetKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

type SandboxBirth = {
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  lat: number;
  lon: number;
  tz?: string;         // optional, defaults to UTC
  houseSystem?: string; // optional, defaults to 'placidus'
};

type SandboxOverrides = {
  planets: Partial<Record<PlanetKey, { lonDeg: number }>>; // 0..360, supports decimals
  angles?: {
    ascDeg?: number;   // optional in 4A
    mcDeg?: number;    // optional in 4A
  };
};

type SandboxDraft = {
  birth: SandboxBirth;
  baseSnapshot: EphemerisSnapshot;
  overrides: SandboxOverrides;
  overriddenSnapshot?: EphemerisSnapshot;
  hash?: {
    birthHash: string;
    overridesHash: string;
    combinedHash?: string;
  };
};
```

### Data Flow

1. **Birth data** → GET `/api/chart-snapshot` → `baseSnapshot` (real EphemerisSnapshot)
2. **Overrides** → POST `/api/sandbox/snapshot` → `overriddenSnapshot` (with planet longitudes overridden)
3. **Overridden snapshot** → architecture-engine → features, personality, guidance, explanation

## Backend Endpoints

### POST /api/sandbox/snapshot

Generate EphemerisSnapshot with planet overrides applied.

**Request:**
```json
{
  "birth": {
    "date": "1990-01-15",
    "time": "12:00",
    "lat": 40.7128,
    "lon": -74.006,
    "tz": "UTC",
    "houseSystem": "placidus"
  },
  "overrides": {
    "planets": {
      "sun": { "lonDeg": 123.4 },
      "moon": { "lonDeg": 210.0 }
    }
  }
}
```

**Response:**
```json
{
  "snapshot": {
    "ts": "1990-01-15T12:00:00Z",
    "tz": "UTC",
    "lat": 40.7128,
    "lon": -74.006,
    "houseSystem": "placidus",
    "planets": [
      { "name": "sun", "lon": 123.4 },
      { "name": "moon", "lon": 210.0 },
      ...
    ],
    "houses": [0, 30, 60, ...],
    "aspects": [...],
    "moonPhase": 0.24,
    "dominantElements": { "fire": 0.3, "earth": 0.2, "air": 0.3, "water": 0.2 }
  },
  "meta": {
    "baseHash": "...",
    "overridesHash": "...",
    "combinedHash": "..."
  }
}
```

**Rules:**
- Fetches base snapshot from `/api/chart-snapshot` (real Swiss Ephemeris)
- Applies planet longitude overrides (normalized to 0-360)
- **Recalculates aspects** using overridden planet positions
- **Recalculates dominantElements** based on overridden planet signs
- **Recalculates moonPhase** if Sun or Moon were overridden
- **Houses remain unchanged** from base snapshot (not recalculated in 4A)
- Unknown planet keys are ignored; only `PLANET_ORDER` planets are processed

### POST /api/sandbox/report

Generate compose-free report (personality, guidance, explanation) from sandbox draft.

**Request:**
```json
{
  "birth": {
    "date": "1990-01-15",
    "time": "12:00",
    "lat": 40.7128,
    "lon": -74.006
  },
  "overrides": {
    "planets": {
      "sun": { "lonDeg": 123.4 },
      "moon": { "lonDeg": 210.0 }
    }
  },
  "seed": "optional-seed-string"
}
```

**Response:**
```json
{
  "features": [0.123, 0.456, ...],  // 64-dim FeatureVec as array
  "personality": {
    "traits": { ... },
    "summary": "..."
  },
  "guidance": {
    "themes": [...],
    "advice": "..."
  },
  "explanation": {
    "summary": "...",
    "factors": [...]
  },
  "seed": "...",
  "meta": {
    "combinedHash": "..."
  }
}
```

**Flow:**
1. Calls POST `/api/sandbox/snapshot` internally (or shared function)
2. `generateArchitectureFromSnapshot(overriddenSnapshot, seed)` → ArchitectureOutput
3. Returns features, personality, guidance, explanation (no compose, no music, no gates)

## Frontend UI Structure (Planned)

### A) Birth Data Step

- `BirthDataForm`: date, time, tz, lat, lon, houseSystem inputs
- CTA: "Load chart"
- Calls GET `/api/chart-snapshot` and stores `baseSnapshot`

### B) Builder Step

- `WheelCanvasBuilder`:
  - Renders wheel + planets from current placements (`overriddenSnapshot` or `baseSnapshot`)
  - Planets are draggable; drag updates `overrides.planets[planet].lonDeg`
  - Side panel "Degrees" with numeric inputs per planet (0..360) + sign readout
  - Changes update wheel immediately (debounced POST `/api/sandbox/snapshot`)

### C) Report Step

- CTA: "Generate report from this draft"
- Calls POST `/api/sandbox/report`
- Renders sections: Personality, Personal Significance, Music Theory (text only, no audio)

**Note:** Do NOT mix with compatibility UI. This is self-exploration only.

## Determinism Verification

### Script: `vnext/scripts/phase4a-sandbox-determinism.ts`

- Fixed birth input: `1990-01-15 12:00, 40.7128, -74.006`
- Fixed overrides: Sun=123.4°, Moon=210.0°
- Calls POST `/api/sandbox/report` 3 times
- Normalizes report JSON (personality, guidance, explanation)
- Prints `REPORT_CHECKSUM=<sha256>` and asserts identical across runs

### Run

```bash
npm run vnext:build
node server/index.js   # in another terminal
node dist/vnext/vnext/scripts/phase4a-sandbox-determinism.js
```

If port 3000 is in use:
```bash
PORT=3001 node server/index.js
API_BASE_URL=http://localhost:3001 node dist/vnext/vnext/scripts/phase4a-sandbox-determinism.js
```

### Checksums (from PASS run)

| Test | Checksum |
|------|----------|
| Report (fixed birth + overrides) | Run verification to populate |

## Implementation Notes

### What is Recalculated

- ✅ **Aspects**: Recalculated using overridden planet longitudes
- ✅ **DominantElements**: Recalculated based on overridden planet signs (planet-name → element mapping)
- ✅ **MoonPhase**: Recalculated if Sun or Moon were overridden
- ❌ **Houses**: Remain from base snapshot (not recalculated in 4A)

### Determinism Guarantees

- Same birth data + same overrides → same `combinedHash`
- Same `combinedHash` + same seed → same features, personality, guidance, explanation
- Planet overrides are normalized to 0-360 range
- Override hash uses sorted planet keys + fixed decimal precision (1 decimal place)

### Architecture Engine Integration

- Sandbox reports use `generateArchitectureFromSnapshot()` — same canonical pipeline as compose
- No reverse transforms: overrides are applied upstream at snapshot level
- No compose/music/gates: reports are text-only (personality, guidance, explanation)

## Verification Checklist

- [x] SandboxDraft contract defined (`vnext/contracts.ts`)
- [x] POST `/api/sandbox/snapshot` endpoint implemented
- [x] POST `/api/sandbox/report` endpoint implemented
- [x] Determinism script created
- [ ] Frontend UI structure (birth data + wheel + report) — pending
- [ ] Determinism verification PASS — run script to verify

## TODOs

- **Frontend UI**: Implement birth data form, wheel builder with drag-and-drop, report rendering
- **Angle overrides**: Add ASC/MC override support (optional in 4A)
- **House recalculation**: Consider recalculating houses from overridden angles in future phase
