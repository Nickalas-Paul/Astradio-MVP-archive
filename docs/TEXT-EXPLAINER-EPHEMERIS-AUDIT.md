# Text Explainer & Swiss EphemerisSnapshot — Audit

**Scope:** How the text explainer relates to EphemerisSnapshot data; how the encoder (feature pipeline) connects — or does not — to the text silo; end-to-end flow from astrology data to explanation text and audio.

---

## 1. Executive Summary

- **The text explainer never receives EphemerisSnapshot directly.** It receives only a `ControlSurfacePayload` (controls + hash).
- **The encoder (`vnext/feature-encode.ts`) does not feed the text silo.** Encoder output (64-dim `FeatureVec`) is used only for **plan generation** (ML → narrative → audio). The text silo is fed by the **payload**.
- **In sky/overlay mode, payload astro fields come from mock data** (`fetchAstroData`), not from real Swiss Ephemeris. So the “astrology” in the explanation text is currently **not** derived from the same EphemerisSnapshot that drives the 64-dim features and thus the audio.
- **Relation to audio:** Audio and text are aligned only in that they share the same **payload** (controls, hash). The **audio** path is: `EphemerisSnapshot → encodeFeatures → FeatureVec → ML → Plan → audio`. The **text** path is: `payload (mock astro + mock student) → atoms → realizer → text`. So both use the same payload for gates and hashing, but the astrology that influences **audio** (via real snapshot → features → guidance) is **not** the same source as the astrology that influences **text** (payload.element_dominance / modality from mock).

---

## 2. Data Flow: EphemerisSnapshot → Audio vs Text

### 2.1 Compose entrypoint (`vnext/api/compose.ts`)

```text
compose(request)
  ├── payload = generateControlPayload(request)     // mock astro + mock student (sky) or sandbox/overlay
  ├── snapshot = fetchChartSnapshot(request)        // REAL Swiss Ephemeris from /api/chart-snapshot
  ├── featureVec = encodeFeatures(snapshot)        // 64-dim from REAL snapshot
  ├── { plan } = generatePlanMLOnly(featureVec, payload)
  ├── gateReport = runAuditionGates(plan, payload.hash)
  ├── text = textExplainer.generateExplanation(payload, gateReport, context)
  └── audio = renderWav60s(plan, payload, …)
```

- **Snapshot** is used only for `encodeFeatures(snapshot)` → `featureVec` → `generatePlanMLOnly`. It is **not** passed to the text explainer.
- **Payload** is what the text explainer sees. In sky mode it is built from `fetchAstroData` (mock) and `runStudentInference(astroData)` (mock).

### 2.2 Where EphemerisSnapshot is produced and consumed

| Producer | Consumer | Purpose |
|----------|----------|--------|
| `GET /api/chart-snapshot` (server) | `compose.ts` via `fetchChartSnapshot()` | Real chart for feature encoding |
| `encodeFeatures(snapshot)` | `generatePlanMLOnly(feat, payload)` | 64-dim input to ML and (via payload as chartContext) optional guidance |
| — | Text explainer | **None.** Text explainer never receives snapshot. |

So: **everything in the encoder that relates to the text silo** is currently **no direct relation** — the encoder output is not used by the text pipeline. The only link is conceptual: the same chart *could* be used to derive an `AstroSummary` (elements, dominant_planets, modality) for the explainer, but that wiring does not exist.

---

## 3. Encoder: What It Encodes (and Who Uses It)

**File:** `vnext/feature-encode.ts`  
**Function:** `encodeFeatures(s: EphemerisSnapshot): FeatureVec` (Float32Array of length 64).

### 3.1 Encoder layout (all indices 0-based)

| Indices | Source in EphemerisSnapshot | Normalization | Used by |
|---------|-----------------------------|--------------|--------|
| 0–9 | `planets` (sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto) | `normDeg(lon)` | ML student; guidance (via featureVec) |
| 10–21 | `houses` (12 cusps) | raw cusp degrees → normDeg | ML student |
| 22–26 | Aspect counts (conjunction, sextile, square, trine, opposition) | count/10, clamp 0–1 | ML student |
| 27 | `dominantElements.fire` | clamp 0–1 | ML; **guidance** (element blend, tempoBias) |
| 28 | `dominantElements.earth` | clamp 0–1 | ML; **guidance** |
| 29 | `dominantElements.air` | clamp 0–1 | ML; **guidance** |
| 30 | `dominantElements.water` | clamp 0–1 | ML; **guidance** |
| 31 | `moonPhase` | clamp 0–1 | ML; **guidance** (cadenceIdx) |
| 32 | Tension heuristic (squares×0.6 + oppositions×1.0) / 12 | clamp 0–1 | ML; **guidance** (arcBias) |
| 33 | Cluster density (planet longitudes) | 1 − maxGap/360 | ML; **guidance** (densityBias) |
| 34–63 | Unused | 0 | Reserved |

### 3.2 Encoder → downstream (no text silo)

- **Plan/Audio path:** `FeatureVec` → `studentVector(feat)` → 6-dim vector → `planFromVector(v6, guidance)` → `Plan` → audition gates → WAV. Guidance is computed in `vnext/astro/guidance.ts` from `featureVec` (elements 27–33) and `chartContext` (EphemerisSnapshot-shaped). In compose, `chartContext` is the **payload**; payload is not an EphemerisSnapshot (no `planets`, `houses`, etc.), so guidance’s sun-based `motifIdx` and full chart context are effectively incomplete or fallback.
- **Text silo:** Does **not** consume `FeatureVec` or `encodeFeatures` output. It consumes only `ControlSurfacePayload` (and optional `AstroSummary`, which is never passed in production — see below).

So: **everything in the encoder that relates to the text silo** today is **nothing** — no code path connects the encoder to the text explainer. The encoder is entirely part of the **audio/plan** pipeline.

---

## 4. Text Silo: What It Receives and How It Uses “Astrology”

### 4.1 Inputs to the text explainer

- **Always:** `ControlSurfacePayload`, `GateReport`, `ExplainerContext`.
- **Never in production:** `AstroSummary` (optional second argument to `generateAtoms` is never passed; see `text-explainer.ts` line 45: `generateAtoms(payload)` only).

So the only “astro” the text silo sees is what is **already on the payload**:

- `payload.element_dominance` ("fire" | "earth" | "air" | "water")
- `payload.modality` ("cardinal" | "fixed" | "mutable")
- `payload.aspect_tension` (0–1)
- Plus numeric controls: `arc_shape`, `density_level`, `tempo_norm`, `step_bias`, `leap_cap`, `rhythm_template_id`, `syncopation_bias`, `motif_rate`, `hash`.

In sky mode these come from:

- `fetchAstroData(skyParams)` → mock `element_dominance`, `modality`, `aspect_tension`
- `runStudentInference(astroData)` → mock numeric controls and again element/modality/aspect

So **no Swiss EphemerisSnapshot data is used to build the text** in the current implementation.

### 4.2 How the text generator uses payload (and implied “astro”)

**File:** `vnext/explainer/atoms-generator.ts`

- **generateAtoms(payload, astro?)**  
  If `astro` is omitted (as in production), it builds a default `AstroSummary` from the payload only:
  - `elements`: fire/earth/air/water set to 0.6 for the payload’s `element_dominance`, 0.1 for others.
  - `modality`: same idea from `payload.modality`.
  - **dominant_planets: []** — so planet-based tints in movement/rhythm/density/astro_color are **never** used in production.

Atoms produced and how they tie to “astro” and controls:

| Atom | Source (payload / astro) | Astro relevance |
|------|---------------------------|------------------|
| **arc_desc** | `payload.arc_shape` + element tint from `AstroSummary.elements` | Element tint phrase (e.g. “echoing Fire’s bursts of energy”) from payload’s element_dominance. |
| **movement** | `payload.step_bias`, `payload.leap_cap`, `astroSummary.dominant_planets` | Planet tint suffix only if `dominant_planets` non-empty (always empty in prod). |
| **rhythm_feel** | `payload.rhythm_template_id`, `payload.syncopation_bias`, `dominant_planets` | Same; no planet tint in prod. |
| **density_desc** | `payload.density_level`, `dominant_planets` | Stellium suffix only if ≥3 dominant planets (never in prod). |
| **motif_desc** | `payload.motif_rate` | No astro; pure control. |
| **astro_color** | `AstroSummary.elements`, `dominant_planets` | “Tone: &lt;element_adjective&gt;, &lt;planet_adjective&gt;.” Element from payload; planet adjective from first dominant planet (none in prod). |

So in practice, **astrology in the text** = **payload.element_dominance** (and modality for the default AstroSummary), plus the control-surface numbers. No planets, no aspects, no houses, no real ephemeris.

### 4.3 Text realizer (`vnext/explainer/text-realizer.ts`)

- Takes **atoms** (from above) and **gateReport**, **seed** (payload.hash).
- **short:** `atoms.astro_color` + `atoms.movement` + `atoms.arc_desc` (and optionally rhythm_feel), length-capped.
- **long:** Sentences built from astro_color, movement, rhythm_feel + tempo fragment, density_desc, motif_desc; or fail hint if gates fail.
- **bullets:** Same atoms, bullet list; or single fail hint.
- **Template id / synonym variation:** Seeded by `payload.hash` for deterministic wording.

No EphemerisSnapshot or FeatureVec is used here; only atoms (which are payload- and default-astro-derived) and gate report.

### 4.4 Mapping table (`vnext/explainer/mapping-tables-v1.json`)

- **element_tints:** fire/earth/air/water/none → phrases like “echoing Fire’s bursts of energy”, “reflecting Earth’s grounded pace”, etc. Used in arc_desc.
- **planet_tints:** Mars, Venus, Mercury, Saturn, Uranus, Neptune, Jupiter → short phrases (“bold push”, “steady connections”, …). Used only when `dominant_planets` is non-empty (never in prod).
- **astro_colors:** element_adjectives and planet_adjectives for the “Tone: …” line. Planet part unused when dominant_planets is empty.
- **movement_descriptions / rhythm_classes / density_descriptions / motif_descriptions:** Driven by control values; optional planet/element “tint” fields exist but planet tint is unused when dominant_planets is [].

So the **encoder** does not appear in the mapping table; the table maps **control + element/modality** (and optionally dominant_planets) to phrases.

---

## 5. Encoder ↔ Text Silo: Summary Table

| Encoder output (feature index) | EphemerisSnapshot source | Used by text silo? | How it could relate to text |
|--------------------------------|--------------------------|--------------------|-----------------------------|
| 0–9 (planet longitudes) | `planets[].lon` | No | Could drive “dominant planet” or sign themes if we derived AstroSummary from snapshot. |
| 10–21 (house cusps) | `houses` | No | Could support house-based phrasing (not implemented). |
| 22–26 (aspect counts) | `aspects` | No | Could drive aspect_tension or aspect-themed phrases from real data. |
| 27–30 (elements) | `dominantElements` | No (text uses payload.element_dominance from mock) | Direct mapping: max element → element_dominance; could feed arc tint and astro_color. |
| 31 (moon phase) | `moonPhase` | No | Could feed “cadence” or mood line in text. |
| 32 (tension) | squares/oppositions | No | Could feed aspect_tension or “intensity” phrasing. |
| 33 (cluster) | planet longitudes | No | Could feed “stellium” or density phrasing. |
| 34–63 | — | No | Reserved. |

So: **everything in the encoder that relates to the text silo** today is **no direct usage**. The relation is only potential: indices 27–33 (and optionally 0–9 for planets) are the natural bridge if we ever derive an `AstroSummary` from the real EphemerisSnapshot and pass it into `generateAtoms`.

---

## 6. How the Text Explainer Relates to the Audio Being Played

- **Shared:** Same **payload** (controls + hash) and same **gate report** (so pass/fail and fail-closed text behavior align with the same plan).
- **Audio content:** Driven by **plan**, which comes from **real** EphemerisSnapshot → encoder → ML → narrative. So the **music** (tempo, arc, density, motif, cadence, events) is influenced by real chart data via the 64-dim features and guidance.
- **Text content:** Driven by **payload** only. In sky mode payload’s astro fields are **mock**. So the **explanation** (“Fire’s bursts of energy”, “Earth’s steady pulse”, etc.) is **not** guaranteed to match the astrology that actually shaped the audio. Alignment is by shared controls and hash, not by shared EphemerisSnapshot.

To make the text “about” the same astrology that influenced the audio, the compose flow would need to:
- Build an `AstroSummary` (and optionally extend payload) from the **same** EphemerisSnapshot used for `encodeFeatures`, and
- Pass that `AstroSummary` into `generateAtoms(payload, astro)`.

---

## 7. File Reference: Encoder and Text Silo

### Encoder (no current connection to text)

- **vnext/feature-encode.ts**  
  - `encodeFeatures(s: EphemerisSnapshot): FeatureVec`  
  - Uses: planets, houses, aspects, dominantElements, moonPhase, aspect counts, cluster heuristic.  
  - Consumed by: `vnext/api/compose.ts` (featureVec → generatePlanMLOnly), `vnext/plan-generator.ts`, `vnext/astro/guidance.ts` (via featureVec and chartContext). **Not** consumed by explainer.

### Text silo (payload and atoms only)

- **vnext/explainer/contracts.ts**  
  - `ControlSurfacePayload`, `AstroSummary`, `ExplainerAtoms`, `TextExplainer`, `GateReport`, `MappingTable`, etc.
- **vnext/explainer/atoms-generator.ts**  
  - `generateAtoms(payload, astro?)` → ExplainerAtoms. Uses payload + optional AstroSummary (defaults from payload; dominant_planets always [] when astro omitted).
- **vnext/explainer/text-realizer.ts**  
  - `generateText(atoms, gateReport, seed)` → short/long/bullets, template_id. No snapshot or FeatureVec.
- **vnext/explainer/text-explainer.ts**  
  - `generateExplanation(payload, gateReport, context)` → text + metrics. Calls `generateAtoms(payload)` with no second argument.
- **vnext/explainer/mapping-tables-v1.json**  
  - Phrase mappings for arc, movement, rhythm, density, motif, element_tints, planet_tints, astro_colors. No encoder indices.

### Compose wiring

- **vnext/api/compose.ts**  
  - Builds payload (mock astro in sky mode), fetches real snapshot, runs encoder, plan, gates, then **textExplainer.generateExplanation(payload, gateReport, context)**. Snapshot/featureVec never passed to explainer.

---

## 8. Conclusion

- **Encoder:** Encodes EphemerisSnapshot into a 64-dim vector used only for ML and guidance in the **plan/audio** path. **Nothing in the encoder is used by the text silo.**
- **Text explainer:** Takes only ControlSurfacePayload (and gate report, context). “Astrology” in the text comes from payload’s element_dominance, modality, aspect_tension — in sky mode these are **mock**, not from Swiss Ephemeris. Optional AstroSummary (e.g. dominant_planets) is never passed, so planet-based phrasing is unused.
- **Alignment with audio:** Audio and text share the same payload and hash; the **music** is driven by real EphemerisSnapshot via the encoder, while the **explanation** is driven by mock astro. To have the text describe the same astrology that influenced the audio, the pipeline would need to derive an AstroSummary (and possibly payload astro fields) from the same EphemerisSnapshot used for encoding and pass it into the text silo.
