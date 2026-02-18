# Swiss Ephemeris Data Flow Audit

**Purpose:** Precise audit of how Swiss Ephemeris data is computed, transformed, and consumed so we can design a clean AstroProfile compiler that reuses existing data. **AUDIT ONLY** — no refactors or new features.

**Scope:** Where Swiss Ephemeris is invoked; raw → normalized → EphemerisSnapshot; what is preserved vs discarded; downstream consumers; implications for AstroProfile.

---

## Executive Summary

| Area | What we have | What we're missing or lossy |
|------|----------------|-----------------------------|
| **Invocation** | Swiss Ephemeris used in `server/index.js` (and mirrored in `vnext/scripts/generate-real-snapshots.ts`) for `GET /api/chart-snapshot`. No Swiss in web app; compose fetches snapshot from backend. | `services/ephemeris/index.ts` has full position type (lon, lat, speed, distance) but is **not** the code path for chart-snapshot; `lib/ephemeris.js` is a shim returning empty data. |
| **Planet data** | 10 planets (sun…pluto), longitude only, in EphemerisSnapshot. | **Speed** requested (`SEFLG_SPEED`) in `calcPositions` but **never written** to `positions` or snapshot. **Latitude**, **retrograde** not stored. **Extras** (Chiron, nodes, etc.) computed in server but **excluded** from snapshot (PLANET_ORDER only). |
| **Houses / angles** | 12 Placidus cusps in `houses[]`. ASC = houses[0], MC = houses[9], IC = houses[3], DSC = houses[6] implicitly. | **ASC/MC/IC/DSC** not stored by name. Swiss `swe_houses` also returns `ascmc` array; we **do not capture** it. |
| **Aspects** | Per-pair, per-type aspects with **orb** in `snapshot.aspects[]` (`a`, `b`, `type`, `orb`). | **Separation** and **exact angle** dropped at snapshot. One pair can have multiple aspect records (e.g. conj + sextile). |
| **Moon phase** | Normalized 0–1 in snapshot; derived from Sun/Moon longitudes. | — |
| **Element dominance** | In snapshot as `dominantElements` (fire, earth, air, water). Server uses **planet-name → element** (e.g. sun/mars/jupiter = fire); script `generate-real-snapshots.ts` uses **sign → element** (longitude/30). Two different definitions in repo. | — |
| **Consumers** | `encodeFeatures` (plan/audio), `astroSummaryFromSnapshot` (explainer), `selectProminentFactors` (explainer factorMap), `guidanceFromFeatures` (plan), `computePersonalityProfileV1` (plan). | — |

---

## 1. Data Flow Map

### Step 1: Swiss Ephemeris call

**Where:** `server/index.js` (and `vnext/scripts/generate-real-snapshots.ts` for eval).

| Call | Purpose | Raw output (Swiss) |
|------|----------|---------------------|
| `swe.swe_julday(...)` | UT Julian day from date/time/lat/lon (with tz conversion via tzlookup + moment) | JD number |
| `swe.swe_calc_ut(jd, id, SEFLG_SWIEPH \| SEFLG_SPEED)` | Planet position (per PLANETS: sun…pluto) | `result.longitude`, `result.xx?.[0]`; speed available but **not read** |
| `swe.swe_calc_ut(jd, SE_SUN/SE_MOON, SEFLG_SWIEPH)` | Sun/Moon for moon phase | longitudes only |
| `swe.swe_houses(jd, lat, lon, 'P')` | Placidus house cusps | `result.house` (12 cusps); `result.ascmc` **not used** |

**Planet set:** `PLANETS` = sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto. `EXTRAS` (chiron, lilith, northNode, southNode, ceres, juno, vesta, pallas) are computed in `calcPositions(jd, true)` but **only PLANET_ORDER** is used for the chart-snapshot response, so extras never appear in EphemerisSnapshot.

### Step 2: Raw → normalized/transformed (server)

| Data | Transformation | Output shape |
|------|-----------------|--------------|
| Planet longitudes | `positions[name] = lon`; 0–360 normalized; **speed/lat not stored** | `{ name, lon }` per planet (planets array) |
| House cusps | `result.house.slice(0, 12)` or equal-house fallback | `houses`: 12 numbers |
| Aspects | `calcAspects(positions)`: angular separation, then match to conjunction/sextile/square/trine/opposition with fixed orbs (8/5/6/6/7°). **Multiple aspects per pair possible.** | Internal: `{ p1, p2, type, angle, orb, separation }` → snapshot: **`{ a, b, type, orb }`** (separation/angle dropped) |
| Moon phase | `moonPhaseNorm(jd)`: (moonLon - sunLon)/360 → 0–1 | `moonPhase`: number |
| Dominant elements | `calcDominantElements(positions)`: **planet-name → element** (fire: sun/mars/jupiter, earth: venus/saturn, air: mercury/uranus, water: moon/neptune/pluto); count then normalize to weights | `dominantElements`: { fire, earth, air, water } |

### Step 3: EphemerisSnapshot shape (API)

Returned by `GET /api/chart-snapshot` (server lines 1100–1141):

```ts
// vnext/contracts.ts
EphemerisSnapshot = {
  ts: string;           // "${date}T${time}:00Z"
  tz: string;          // "UTC"
  lat: number;
  lon: number;
  houseSystem: string; // "placidus"
  planets: Array<{ name: string; lon: number; lat?: number; speed?: number }>;  // lat/speed never set by server
  houses: [number, ...]; // 12 cusps
  aspects: Array<{ a: string; b: string; type: 'conjunction'|'sextile'|'square'|'trine'|'opposition'; orb: number }>;
  moonPhase: number;
  dominantElements: { fire: number; earth: number; air: number; water: number };
}
```

### Step 4: Which modules consume which fields

| Consumer | File(s) | Fields used |
|----------|---------|-------------|
| **encodeFeatures** | `vnext/feature-encode.ts` | `planets` (lon by name), `houses`, `aspects` (counts by type + squares/opps for tension), `dominantElements`, `moonPhase`; cluster heuristic from planet longitudes only |
| **astroSummaryFromSnapshot** | `vnext/explainer/astro-summary-from-snapshot.ts` | `planets`, `aspects` (for dominant planet scoring); `dominantElements` (or featureVec 27–30); `ts` |
| **selectProminentFactors** | `vnext/explainer/prominence.ts` | `dominant_planets` from astroSummary (from snapshot); `snapshot.houses` (length ≥10 → angles from cusps 0,9,3,6); `snapshot.aspects` (with orb for weighting) |
| **guidanceFromFeatures** | `vnext/astro/guidance.ts` | featureVec 27–33, 31; **chartContext.planets** (sun lon for motifIdx), **chartContext** passed to personality profile |
| **computePersonalityProfileV1** | `vnext/astro/personality-profile.ts` | featureVec indices; **chartContext.planets** (planetLon for sun, moon, mercury, etc.) |
| **plan-generator** | `vnext/plan-generator.ts` | chartContext (payload) **converted** to EphemerisSnapshot-like shape for guidance (planets, houses, aspects, moonPhase, dominantElements); so guidance/personality see snapshot-like data when available |

**Explicitly not used by any consumer (in current code):** planet `lat`, `speed`; house labels (ASC/MC/IC/DSC by name); aspect `separation` or exact angle; Swiss `ascmc` array.

---

## 2. EphemerisSnapshot Field Inventory

| Field | Data type | Origin | Current consumers | Unused / underused |
|-------|-----------|--------|-------------------|---------------------|
| `ts` | string | Derived (date+time string) | astroSummary (ts), plan-generator (chartContext.ts) | — |
| `tz` | string | Fixed "UTC" | Pass-through in plan-generator snapshot shape | Not used for logic |
| `lat` | number | Request (query) | Pass-through | Not used for encoding or explainer |
| `lon` | number | Request (query) | Pass-through | Not used for encoding or explainer |
| `houseSystem` | string | Fixed "placidus" | Pass-through | Not used for logic |
| `planets` | `{ name, lon }[]` | Swiss raw (longitude only) | encodeFeatures (0–9), astroSummary (dominant scoring), prominence (via astro), guidance (sun lon), personality-profile (planetLon) | **lat?, speed?** in type never set; underused for full sign/house derivation |
| `houses` | 12-tuple number | Swiss swe_houses (Placidus) | encodeFeatures (10–21), prominence (ASC/MC/IC/DSC from indices 0,9,3,6) | Angles not named; ascmc not captured |
| `aspects` | `{ a, b, type, orb }[]` | Derived (calcAspects from positions) | encodeFeatures (counts by type, tension), astroSummary (aspect counts per planet), prominence (full list + orb) | **Orb** used in prominence only; separation/angle discarded at snapshot |
| `moonPhase` | number (0–1) | Derived (Sun/Moon lon) | encodeFeatures (31), guidance (cadenceIdx), personality (moonClimate etc.) | — |
| `dominantElements` | 4 numbers | Derived (planet-name → element on server; sign→element in script) | encodeFeatures (27–30), astroSummary (or overridden by featureVec), guidance/personality via elementBlend | Two different derivation rules in repo |

---

## 3. Lossy Transformations

### 3.1 Collapse of continuous data into buckets

- **Tension (feature 32):** `(squares*0.6 + opps*1.0)/12` then clamp 0–1. Continuous aspect counts → single scalar.
- **Cluster density (feature 33):** `1 - maxGap/360` over planet longitudes. Continuous distribution → single scalar.
- **Moon phase:** Already 0–1; used as-is and also binarized in guidance (`cadenceIdx = moonPhase < 0.5 ? 0 : 1`).
- **Elements:** Normalized to sum 1; then used as continuous in guidance/personality; no bucketing of elements themselves.

### 3.2 Discarded information

- **Planet:** Speed (requested via SEFLG_SPEED but never stored); latitude; retrograde (would need speed sign). **Extras** (Chiron, nodes, etc.) computed but not in snapshot.
- **Aspects:** `separation` and `angle` dropped when building snapshot (only `a, b, type, orb` kept). Orb is preserved.
- **Houses:** Only 12 cusps; no explicit ASC/MC/IC/DSC labels; Swiss `ascmc` array not captured.
- **Sign/house of planet:** Not stored; could be derived from lon + cusps but is not computed in one place for the whole pipeline.

### 3.3 Heuristics replacing concrete astro facts

- **Dominant elements (server):** By **planet identity** (sun/mars/jupiter = fire, etc.), not by sign placement. So “dominant fire” = “many fire planets in the chart” by traditional rulership, not “many planets in fire signs.”
- **Dominant elements (generate-real-snapshots.ts):** By **sign** (longitude/30 → Aries/Leo/Sag = fire, etc.). Different from server; script is used for eval snapshots.
- **Dominant planets:** Heuristic in `astro-summary-from-snapshot.ts`: priority weight (sun=10…pluto=1) + 2× aspect involvement count, tie-break by longitude. Not house/sign strength.
- **Tension:** Squares and oppositions only; fixed weights (0.6, 1.0); no orb weighting.
- **Clustering:** Purely geometric (max gap in longitude); no aspect links or house grouping.

---

## 4. Aspect Handling Audit

- **Do we store per-pair aspects?** **Yes.** `snapshot.aspects[]` is an array of `{ a, b, type, orb }`. One pair (e.g. Sun–Mars) can appear in multiple entries (e.g. conjunction and sextile) if both fit orb rules.
- **Do we have orb values?** **Yes.** `orb` is stored and used in `prominence.ts` (tight orb < 5° adds weight). Not used in encodeFeatures (only counts per type).
- **Where should aspect derivation live?** Today aspects are **derived in the snapshot stage** (server `calcAspects(positions)`). They are not re-derived in vnext. An AstroProfile compiler could **consume** `snapshot.aspects` as-is, or re-derive from `planets[].lon` + optional orb rules for consistency. Best place for a **single** definition is snapshot stage (or a shared “aspect calculator” used by chart-snapshot and profile compiler) so orb rules and planet set are consistent.

---

## 5. Angles and Houses Audit

- **Do we store ASC/MC/IC/DSC explicitly?** **No.** We store 12 house cusps. Conventionally: ASC = cusp 1 = `houses[0]`, MC = cusp 10 = `houses[9]`, IC = cusp 4 = `houses[3]`, DSC = cusp 7 = `houses[6]`. So they are **implicit**.
- **Or only house cusps?** **Only house cusps** in the snapshot. No separate “angles” object.
- **Are houses computed using Swiss or inferred later?** **Swiss.** `swe.swe_houses(jd, lat, lon, 'P')` (Placidus). Fallback to equal house (30° each) only on error. No later inference of houses from longitudes.
- **Are angles used anywhere today?** **Yes, implicitly.** `prominence.ts` uses `snapshot.houses` and maps indices 0, 9, 3, 6 to ASC, MC, IC, DSC for “angle” factors when building the factor map. No other consumer uses angles by name; encodeFeatures uses all 12 cusps as 12 numbers (indices 10–21).

---

## 6. Prominence Logic Today

- **Dominant planets:** From `astroSummaryFromSnapshot` → `dominant_planets` (1–3). Algorithm: score = priority weight (sun 10 … pluto 1) + 2 × (number of aspects involving that planet); sort by score desc, then by longitude asc; take top 3; capitalize names. So **real** aspect involvement and planet list from snapshot; priority weights are **convenience** (inner planets favored).
- **Element dominance:** **Server:** count of planets per element by **planet name** (fire: sun/mars/jupiter, etc.), then normalize. **Script:** sign from longitude (lon/30), then element by sign (Aries/Leo/Sag = fire, etc.). So server uses traditional rulership; script uses sign placement. Both are **deterministic** but **different**.
- **Tension heuristic:** In encoder: `(squares*0.6 + opps*1.0)/12`, clamped. Based on **real** aspect counts from snapshot; weights (0.6, 1.0) are **convenience**.
- **Clustering heuristic:** In encoder: `1 - maxGap/360` over sorted planet longitudes. **Convenience** (geometric only; no aspects or houses). Not real astrological “clustering” (e.g. stellia).
- **Summary:** Dominant planets and aspect counts are based on **real** snapshot data; element dominance has **two** definitions (planet-name vs sign-based); tension/clustering are **simple heuristics** that could be replaced by more astrologically grounded metrics in an AstroProfile compiler.

---

## 7. Implications for AstroProfile Compiler Design

### 7.1 What the AstroProfile compiler should consume directly

- **EphemerisSnapshot as returned today:** `planets` (lon), `houses`, `aspects` (a, b, type, orb), `moonPhase`, `dominantElements`. This is enough to avoid re-calling Swiss Ephemeris.
- **Optional:** If the compiler needs **one** definition of element dominance, decide between (a) planet-name (server) vs (b) sign-based (script) and have the compiler either consume `dominantElements` (and document which derivation was used) or derive from `planets[].lon` itself.
- **Angles:** Derive ASC/MC/IC/DSC from `houses[0], [9], [3], [6]` in the compiler; no need to change snapshot for that.

### 7.2 What should move out of encodeFeatures/guidance into profile logic

- **Tension / clustering:** Currently in encodeFeatures as indices 32–33. If AstroProfile defines its own “tension” or “clustering” (e.g. aspect-weighted, or house-based), that logic could live in the profile compiler and **optionally** still feed a scalar into the 64-dim vector for ML, or the ML could be refactored later to take profile outputs.
- **Dominant planets / elements:** Already derived in explainer (astroSummaryFromSnapshot) and in server (dominantElements). Profile compiler could be the **single** place that defines “dominant planets” and “element blend” from snapshot (planets + aspects + houses), and explainer/encoder consume profile outputs instead of re-deriving.

### 7.3 What should remain audio-only

- **64-dim FeatureVec** and **encodeFeatures** are tied to the current ML plan model. Until the model or pipeline is changed, **audio** path should keep using the same encoding (planets 0–9, houses 10–21, aspect counts 22–26, elements 27–30, moonPhase 31, tension 32, cluster 33, pad 34–63). The AstroProfile compiler can **reuse** the same snapshot and optionally expose a richer profile for explainer/UI without changing the audio pipeline.

---

## 8. File Reference Summary

| Role | File(s) |
|------|--------|
| Swiss Ephemeris invocation | `server/index.js` (PLANETS, EXTRAS, toJulianDayUT, calcPositions, calcPlacidusCusps, calcAspects, calcDominantElements, moonPhaseNorm; GET /api/chart-snapshot) |
| Eval snapshot generation (mirrors server) | `vnext/scripts/generate-real-snapshots.ts` |
| EphemerisSnapshot type | `vnext/contracts.ts` |
| Snapshot → features | `vnext/feature-encode.ts` (`encodeFeatures`) |
| Snapshot → astro summary | `vnext/explainer/astro-summary-from-snapshot.ts` |
| Prominence (factors for explainer) | `vnext/explainer/prominence.ts` (`selectProminentFactors`) |
| Guidance / personality | `vnext/astro/guidance.ts`, `vnext/astro/personality-profile.ts` |
| Plan generator (chartContext → snapshot-like) | `vnext/plan-generator.ts` |
| Alternative ephemeris (not chart-snapshot path) | `services/ephemeris/index.ts` (richer position type); `lib/ephemeris.js` (shim) |
| Legacy encoder (uses lib/ephemeris shim) | `lib/features/feature-encoder.js` |

---

## 9. Clear Recommendations

1. **AstroProfile compiler should consume:** The existing EphemerisSnapshot from `GET /api/chart-snapshot` (or equivalent). No need to re-invoke Swiss Ephemeris; reuse `planets`, `houses`, `aspects`, `moonPhase`, `dominantElements`.
2. **Single source for element dominance:** Choose either server’s planet-name rule or sign-based rule; document it and use it in the profile compiler so explainer and any future UI use the same definition.
3. **Aspects:** Keep per-pair, per-type with **orb** at snapshot level. Profile compiler can consume `snapshot.aspects`; optionally add a shared aspect calculator if orb rules or planet set are ever parameterized.
4. **Angles:** In profile, derive ASC/MC/IC/DSC from `houses[0], [9], [3], [6]`; no API change required.
5. **Speed / latitude / retrograde:** If the compiler or explainer later need them, add them at the **snapshot** stage (server already has speed in Swiss result; not written through). Type already has `lat?`, `speed?`.
6. **What remains audio-only:** The 64-dim encoding and indices 0–33 logic should remain as-is for the current ML path until a deliberate change; the profile compiler can sit alongside and feed explainer/UI only.

---

*End of audit. No code was changed.*
