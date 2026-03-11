## Canonical chart contract

All chart-derived surfaces share one canonical source of truth:

```text
EphemerisSnapshot
```

Produced by:

- `GET /api/chart-snapshot` (Swiss Ephemeris → `EphemerisSnapshot`)
- `POST /api/sandbox/snapshot` (base snapshot from `/api/chart-snapshot` + overrides)
- `generateArchitecture` / `generateArchitectureFromSnapshot` (internal pipeline)

### Snapshot contents

The canonical snapshot includes:

- **Bodies**: 15 supported bodies (core 10 + Chiron, Ceres, Pallas, Juno, Vesta) via `SUPPORTED_BODIES` / `BODY_DISPLAY_ORDER`
- **Geometry**:
  - `planets: [{ name, lon, lat?, speed? }]`
  - `houses: number[12]` (Placidus cusps; first cusp is ASC)
- **Relational data**:
  - `aspects: SnapshotAspect[]` with:
    - `bodyA`, `bodyB` (canonical pair)
    - `type` (`conjunction`, `sextile`, `square`, `trine`, `opposition`)
    - `orb`, `exactAngle?`
    - `dynamics?`, `strength?`, `exactness?`, `priorityBase?`
    - optional `motion?` (`applying` / `separating`), when available
- **Summary metrics**:
  - `moonPhase`
  - `dominantElements: { fire, earth, air, water }`

All downstream chart geometry must be derived from this structure (or from architecture outputs that embed it).

### Relational chart context

Reporting and text systems use a normalized relational view:

- `buildRelationalChartContext(snapshot)` → `RelationalChartContext`:
  - `bodies: string[]` (names present in snapshot)
  - `aspects: SnapshotAspect[]`
  - `topAspects: SnapshotAspect[]` (ranked via aspect priority)
  - `hasAspectData: boolean`
  - `houses: number[]` (first 12 cusps)

This context must be computed from the canonical `EphemerisSnapshot`, never recomputed independently in UI code.

---

## Shared chart surfaces

### Sandbox (`/sandbox`)

- **Source**:
  - `POST /api/sandbox/snapshot` → overridden `EphemerisSnapshot`
  - `POST /api/sandbox/report` → architecture output + `relationalContext`
- **Wheel / chart**:
  - `WheelCanvasBuilder` consumes `EphemerisSnapshot` directly
  - Geometry: `planets` + `houses` from snapshot
  - Aspect lines: drawn from `snapshot.aspects` only
- **Role**:
  - Primary relational visualization surface
  - Full 15-body support, canonical labels/order, aspect metadata

### Hero (`/`)

- **Source**:
  - `POST /api/compose` (audio + explanations)
  - `GET /api/chart-snapshot` (same date/time/lat/lon as compose request)
- **Wheel / chart**:
  - Wheel geometry derived from `EphemerisSnapshot` via `/api/chart-snapshot`
  - Adapter: `normalizeChartForWheel(snapshot)` (positions from `planets`, cusps from `houses`)
  - No aspect lines on hero; positional display only
- **Role**:
  - Positional chart display synchronized with the “today” composition

### Overlay (`/overlay`)

- **Source**:
  - Two `EphemerisSnapshot` instances loaded via `/api/chart-snapshot` (e.g. “Today”, “Natal”)
- **Wheel / chart**:
  - Overlay wheel geometry derived from one of the canonical snapshots (no local `{positions, cusps}` model)
  - `WheelCanvas` normalizes snapshots via `normalizeChartForWheel`
  - No aspect recomputation; no suffixed body keys
- **Role**:
  - Presentation composite for comparing charts and triggering overlay compositions
  - Geometry remains snapshot-derived and uses canonical body set

### Profile / Community

- **Source**:
  - `GET /api/profile/chart` → `snapshot: EphemerisSnapshot`, `relationalContext`, explainer sections
- **Wheel / chart**:
  - `WheelCanvas` receives `snapshot` and normalizes via `normalizeChartForWheel`
  - Positional display only (no aspect lines)
- **Text / reports**:
  - ExplainSpec and profile explainers consume `snapshot` + `relationalContext`
- **Role**:
  - Positional view of stored charts (self and others) with access to enriched relational data for reporting

### Viz (music visualizer / dev viz)

- **Source**:
  - Server viz payload builder: `buildVizPayload(snapshotLike, plan, compose_meta)` where `snapshotLike` is derived from `EphemerisSnapshot`
- **Wheel / chart**:
  - Houses, planet longitudes, and viz-aspects derived from snapshot geometry and `snapshot.aspects`
  - Aspect lines in 3D viz are always fed by snapshot-derived aspects; no UI recomputation
- **Role**:
  - Visualizes musical structure anchored to canonical chart geometry and aspect data

---

## Surface responsibilities

- **Sandbox**
  - Owns the most complete relational visualization:
    - Full 15-body wheel
    - Aspect lines directly from `snapshot.aspects`
    - `relationalContext` surfaced on report endpoints
  - Reference surface for validating snapshot content and aspect metadata

- **Hero / Profile / Community wheels**
  - Positional displays:
    - Geometry always derived from `EphemerisSnapshot` (`planets` + `houses`)
    - Use shared `WheelCanvas` and canonical body ordering/glyphs
  - Do **not** add aspect lines or perform aspect math

- **Overlay**
  - Presentation composite built **from snapshots only**:
    - Two `EphemerisSnapshot` inputs
    - Visual geometry adapted from canonical snapshots
  - Does not own or duplicate relational math; compatibility and overlay text/audio are handled server-side

- **Viz**
  - Uses snapshot-derived chart geometry and aspects to drive visual motifs
  - May decorate or stylize the wheel, but must not introduce alternate body lists or aspect engines

---

## Forbidden patterns (UI and adapters)

The following are explicitly disallowed in UI layers, adapters, and chart surfaces:

- **Recomputing aspects**:
  - No UI component may implement its own aspect engine
  - Aspect lines must be sourced from `snapshot.aspects` (or from a viz payload that itself comes from `snapshot.aspects`)

- **Local planet registries**:
  - No hard-coded 10-planet arrays in UI
  - Planet sets must come from `SUPPORTED_BODIES` / `BODY_DISPLAY_ORDER` or from snapshot `planets`

- **Reduced chart models when snapshots exist**:
  - No `{ positions, cusps }` models built ad hoc when a canonical `EphemerisSnapshot` is already available
  - Geometry must be adapted from:
    - `EphemerisSnapshot` (preferred), or
    - architecture outputs that embed the same snapshot data

- **Alternate body ordering systems**:
  - All wheels and chart displays must:
    - Use `BODY_DISPLAY_ORDER` for ordering
    - Use `BODY_LABELS` / shared glyph maps for display naming
  - No surface may silently reorder or filter bodies without explicit, documented product scope

Text systems (ExplainSpec, astro summaries, feature encoders) may retain classic 10-planet emphasis internally, as long as:

- They consume `EphemerisSnapshot` and `relationalContext`, and
- They do not expose alternate, conflicting chart geometries or body registries back to UI layers.

