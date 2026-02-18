# Music Composition System Audit (Read-Only)

**Scope:** How Swiss Ephemeris data becomes musical output; variation vs looping; rules/templates/mappings; determinism vs implicit vs accidental.  
**No code changes.** Documentation only.

---

## 1. Full Music Pipeline (End to End)

### Textual flow

```
Chart (date/time/lat/lon)
  → Swiss Ephemeris (server)
  → EphemerisSnapshot (/api/chart-snapshot)
  → Feature encoding (64-dim)
  → ML model (student)
  → 6-dim vector + guidance (astro biases)
  → Plan (events, bpm, key)
  → Audition gates (quality + timewarp)
  → Audio events (WAV stub or Tone.js)
  → Output (base64 WAV + explanation)
```

**Concise flow:**  
**Chart → EphemerisSnapshot → Features (64) → ML (6) → Plan (narrative) → Audio Events → Output**

**Dual path in compose:** For sky/overlay, the API builds (1) **payload** from mock astro (`fetchAstroData` + `runStudentInference`) and (2) **snapshot** from real Swiss Ephemeris (`fetchChartSnapshot`). The **64-dim feature vector** used by the ML model comes from the **snapshot** (real chart). The **payload** is used for text explanation, gates, and as **chartContext** in `generatePlanMLOnly`; because payload is not an EphemerisSnapshot, guidance’s sun-based motif index is effectively unused (see §7).

### Files and line ranges by stage

| Stage | File(s) | Line ranges | Notes |
|-------|---------|--------------|--------|
| **a) Swiss Ephemeris chart generation** | `server/index.js` | 370–506, 1085–1126 | `toJulianDayUT`, `calcPositions`, `calcPlacidusCusps`, `calcAspects`, `calcDominantElements`, `moonPhaseNorm`; `GET /api/chart-snapshot` returns EphemerisSnapshot. Alternative: `services/ephemeris/index.ts` (getChartData, chart hash cache). |
| **b) Feature extraction / vector encoding** | `vnext/feature-encode.ts` | 9–72 | `encodeFeatures(snapshot)` → Float32Array(64). Planets 0–9, houses 10–21, aspect counts 22–26, elements 27–30, moon phase 31, tension 32, cluster 33, pad 34–63. |
| **c) Composition planning / rule selection** | `vnext/plan-generator.ts` | 50–114 | `generatePlanMLOnly(feat, chartContext)` → studentVector(64→6), jitter K candidates, `planFromVector(v6, guidance)`, ruleQualityPass, pick best. Guidance from `vnext/astro/guidance.ts` (tempo/arc/density/motif/cadence). |
| **d) Plan → events (narrative)** | `vnext/planner/narrative.ts` | 35–148 | `planFromVector(v6, guidance)` → Plan: bpm, key, melody/harmony/bass/rhythm EventTokens; 16 bars, 4 phrases, MOTIFS/CADENCE_ENDS. |
| **e) Instrument / synth / sampler** | `vnext/audio/wav-renderer.ts` | 20–29 | **Stub only** – throws unless real implementation provided. `vnext/scheduler.ts`: `planToToneEvents(plan)` → Tone.js-style events (no actual synth in repo). Server `generateAudioBuffer` (server/index.js ~1713–1756): sine waves per note. |
| **f) Transport / timing / 60s** | `vnext/planner/narrative.ts` | 16, 72, 138–141 | `DUR_SEC = 60`, `totalBeats = BARS*4` (64 beats), `secondsPerBeat = 60/bpm`, `duration = Math.min(DUR_SEC, totalBeats*secondsPerBeat)` → **capped at 60s, can be shorter** (e.g. ~54.9s at 70 BPM). `vnext/audition-gate.ts` 34–43: single timewarp to target duration if maxEnd differs from cfg.duration by >1s. |

---

## 2. Inventory of Musical Elements

For each category: **where defined**, **inputs**, **static / rule-based / feature-driven**.

| Category | Where defined | Inputs | Type |
|----------|----------------|--------|------|
| **Tempo selection** | `vnext/planner/narrative.ts` 44–46 | ML v6[0] (vTempo), guidance.tempoBias (elements 27–30) | Feature-driven (ML + rule bias) |
| **Time signature** | Implicit 4/4 | — | Static (PPQ=4, 4 beats per bar) |
| **Key / mode selection** | `vnext/planner/narrative.ts` 145 | Literal `"A minor"` | Static |
| **Chord progression logic** | `vnext/planner/narrative.ts` 120–127 | phraseCenters (from vBright, vArc, guidance) | Rule-based (triads under phrase center per bar) |
| **Harmonic rhythm** | `vnext/planner/narrative.ts` 120–127 | One triad per bar (4 beats) | Static (chord change every bar) |
| **Bassline logic** | `vnext/planner/narrative.ts` 111–119 | phraseCenters, bar grid | Rule-based (tonic 2 beats, dominant 2 beats per bar) |
| **Melody / lead logic** | `vnext/planner/narrative.ts` 84–108 | MOTIFS (8 shapes), density, phraseCenters, cadenceIdx | Feature-driven (motif index from guidance or ML; density from v6 + guidance) |
| **Rhythmic patterns / groove** | `vnext/planner/narrative.ts` 129–136 | Bar grid | Static (kick 1&3, hat 2&4; fixed pattern every bar) |
| **Instrument assignment** | `vnext/contracts.ts` 24, narrative.ts push(… channel) | Channel: melody, harmony, bass, rhythm | Static (channel names only; no timbre mapping in narrative) |
| **Envelope / filter / velocity** | Narrative: velocity in push(…) | vel 0.7–0.9 melody, 0.7 bass, 0.5 harmony, 0.4/0.8 rhythm | Rule-based (fixed per channel) |
| **Sectioning (intro/develop/etc)** | `vnext/planner/narrative.ts` 52–58, 86 | phraseCenters (4 phrases), arcLift | Rule-based (4 phrases × 4 bars; arc lifts phrase 2–3) |

**Summary:** Tempo, arc, density, motif, and cadence are feature/ML-driven; key, time signature, harmonic rhythm, groove pattern, and instrument roles are static or rule-based. No explicit “intro/verse/chorus” labels; sectioning is implicit (4 phrases).

---

## 3. Determinism and Seeding

### What seeds the composition?

- **Primary:** `payload.hash` (used in `generatePlanMLOnly` as `chartContext.hash` or `chartContext.controls?.hash`). Hash is from `generateHash(astroData)` in sky mode (lat, lon, datetime → mock element/modality/aspect_tension) or from merged sandbox controls.
- **Chart hash:** Not used in the compose pipeline. `lib/hash/chartHash.js` and `generateChartHashSync` are used in `services/ephemeris/index.ts` for caching only. Compose does not pass chart hash into ML or narrative.
- **Idempotency key:** `requestKey = sha256(JSON.stringify(request) + runtimeModel)`; same request → cache hit → same response.

### Math.random / time-based calls in compose path

| Location | Usage | Affects output? |
|----------|--------|------------------|
| `vnext/planner/narrative.ts` 140 | `id: \`plan_${Date.now()}\`` | Yes: plan.id differs every run; plan is not returned in API response but is used for audio and logging. |
| `vnext/plan-generator.ts` 57 | `seedStr = chartContext.hash \|\| "seed"`; RNG from seed | No: deterministic. |
| `vnext/plan-generator.ts` 84 | `jitter(base, JITTER, rng)` with seeded RNG | No: deterministic for fixed hash. |
| `vnext/api/compose.ts` 506–519 | `runAuditionGates(plan, payload.hash)` – internal RNG from seed | No: deterministic. |
| `vnext/api/compose.ts` 676, 683 | `generateSessionId` / `generateRequestId` use `Date.now()` | No: logging/IDs only, not audio or plan. |
| `vnext/api/compose.ts` 372, 379, 384 | Default date from `new Date().toISOString()` when request omits date | Yes: if client omits date/time, chart and thus features change with time. |

**Conclusion:** For a **fixed chart input** (date, time, lat, lon) and same request body, the only non-determinism in the composition itself is `plan.id` (timestamp). Audio and control output are deterministic. If the request does not fully specify date/time/lat/lon, defaults use current time and affect chart/features.

---

## 4. Where Repetition Is Introduced

### Loops / schedulers that repeat unchanged patterns

| Location | What repeats | Intentional or accidental |
|----------|----------------|----------------------------|
| `vnext/planner/narrative.ts` 85–108 | Melody: same motif shape every bar (2–3 “drops” per bar), transposed by phrase center; cadence on last beat of every 4th bar | Intentional (design: 16 bars, motif-driven). |
| `vnext/planner/narrative.ts` 111–119 | Bass: tonic 2 beats + dominant 2 beats every bar, every phrase | Intentional (ostinato). |
| `vnext/planner/narrative.ts` 121–127 | Harmony: same triad pattern (root+3+7) every bar, 4-beat block | Intentional. |
| `vnext/planner/narrative.ts` 130–136 | Rhythm: kick 1&3, hat 2&4 every bar | Intentional (fixed groove). |
| `vnext/planner/narrative.ts` 60 | `motifIdx` from guidance or ML → one of 8 MOTIFS for entire piece | Intentional (one motif per composition). |
| `vnext/planner/narrative.ts` 63 | `cadenceIdx` → one of 4 CADENCE_ENDS for all phrase endings | Intentional. |

### Musical layers that never change once started

- **Rhythm channel:** Same kick/hat pattern every bar.
- **Bass:** Same tonic–dominant pattern every bar (pitch follows phrase center only).
- **Harmony:** Same block-triad structure every bar (pitch follows phrase center only).
- **Melody:** Same motif contour every bar (pitch and bar-offset vary by phrase center and density; motif shape is fixed for the piece).

### Summary

Repetition is **intentional by design**: 4/4 grid, 16 bars, one motif, one cadence target, fixed groove and harmony pattern. Variation comes from phrase centers (arc), density (drops per bar), and which motif/cadence index is chosen, not from changing patterns over time.

---

## 5. Feature-to-Music Mapping Audit

### Which astrological features currently affect music?

| Musical dimension | Feature(s) / path | How |
|-------------------|-------------------|-----|
| **Tempo** | Elements (27–30) → tempoBias; ML v6[0] | guidance.tempoBias (fire+air vs earth+water) biases vTempo; lerp(70, 140, biasedTempo) → BPM. |
| **Harmony** | v6[1] (bright), v6[3] (arc), guidance.arcBias | phraseCenters, triad roots (no key change; key is fixed “A minor”). |
| **Rhythm** | — | No aspect/element mapping; rhythm is fixed (kick/hat). |
| **Melody** | v6[2] density, v6[4] motif, v6[5] cadence; guidance densityBias, motifIdx, cadenceIdx | Density → drops per bar; motifIdx/cadenceIdx from guidance (sun sign → motif; moon phase → cadence) or from ML. |
| **Instrumentation** | — | No chart-driven assignment; channels (melody/harmony/bass/rhythm) are fixed. |

### Unused chart data

- **Planet longitudes (0–9):** Used in 64-dim encoding; only **sun** longitude is used again in **guidance** (motifIdx). Moon phase (31) used for cadenceIdx. Other planets (mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto) are not used in guidance or narrative beyond the 64→6 ML mapping.
- **House cusps (10–21):** In feature vector only; no explicit use in narrative or guidance.
- **Aspect counts (22–26):** In feature vector; tension (32) is derived from square/opposition count and used for arcBias. Conjunction, sextile, trine counts are in the vector but not separately used in guidance.
- **Planet speeds, latitudes:** Not in EphemerisSnapshot used by compose; not encoded. Server `calcPositions` can return speed (Swiss Ephemeris) but chart-snapshot only passes `lon` for planets.
- **North/south node, extras:** Server has EXTRAS (e.g. northNode); chart-snapshot uses PLANET_ORDER only (sun…pluto). Nodes not in feature vector.

### Single-point collapse

- **Motif + cadence:** Many chart features (all 64 dims) feed into one 6-dim vector; from that, **motifIdx** (one of 8) and **cadenceIdx** (one of 4) are chosen. So many features collapse to two discrete choices for the whole piece.
- **Key:** Not driven by chart at all; single static value “A minor”.

---

## 6. Output Artifacts

### What `/api/compose` returns (music-related)

From `vnext/api/compose.ts` (response object ~252–319):

- **controls:** ControlSurfacePayload (arc_shape, density_level, tempo_norm, step_bias, leap_cap, rhythm_template_id, syncopation_bias, motif_rate, element_dominance, aspect_tension, modality, hash).
- **gate_report:** GateReport (calibrated/strict melody_arc, melody_step_leap, melody_narrative, rhythm_diversity, overall; scores; latency_ms).
- **audio:** format, base64, sha256, digest, latency_ms, size_bytes (no `url` in current implementation when using base64).
- **explanation:** Theme/Details/Bullets (from text explainer).
- **hashes:** control, audio, explanation, viz.
- **artifacts:** model, encoder, chartHash (mock), featuresVersion, snapset, gate, mapping_tables_version, timestamp, provenance (chartHash, seed, featuresVersion, modelVersions, houseSystem, tzDiscipline).
- **telemetry:** ml_used, inference_ms, model_version, model_sha, tf_backend.

The **plan** (events, bpm, key) is **not** returned; it is used only server-side for gates and (when ENABLE_WAV_EXPORT=1) for WAV rendering.

### Implicit “plan”

The plan is an explicit structure (`Plan` with events, bpm, key) built in `planFromVector`. It is not exposed as a first-class “plan” in the API, but it is the single source for audition gates and for `renderWav60s`; so the “plan” is implicit from the client’s perspective (only controls + audio + explanation + gates are visible).

### Telemetry / debug signals

- **Console:** `[COMPOSE] Feature vector: ...`, `[COMPOSE_ML]`, `[COMPOSE_OBS]` (logEntry with compose_hash, gate_pass, audio_sha256, latency_ms, gate_scores, ml, etc.), `[COMPOSE] Cached composition...`.
- **logAudit:** `evt: 'compose_done'` with request_id, compose_hash, feature_checksum, gate_pass, audio_sha256, latency_ms, controls_hash, seed_used, template_id, latency_ms breakdown, gate_scores, gates, artifacts, ml.
- **Response:** telemetry (ml_used, inference_ms, model_version, model_sha, tf_backend); gate_report (scores and pass/fail); hashes (control, audio, explanation).

---

## 7. Gaps Between Available Astro Data and Musical Use

- **Key/mode:** Chart and elements are not mapped to key or mode; key is fixed “A minor”.
- **Rhythm/groove:** No chart-driven rhythm pattern, syncopation, or meter change; groove is fixed.
- **Instrumentation/timbre:** No mapping from chart to instruments or patches.
- **Houses:** Encoded (10–21) but not used in guidance or narrative.
- **Aspect types:** Only square/opposition used explicitly (tension); conjunction, sextile, trine only via 64-dim.
- **Planet speeds/latitudes:** Not in snapshot/encoding.
- **Guidance context bug:** In `generatePlanMLOnly`, `chartContext` is the **payload** (ControlSurfacePayload), not the EphemerisSnapshot. So `guidanceFromFeatures(feat, chartContext)` receives a synthetic snapshot built from payload (no planets, default houses/moonPhase). Result: **motifIdx** from sun longitude is always 0 (no sun in payload); cadenceIdx still uses featureVec[31] (moon phase). So sun-sign→motif mapping is effectively unused in production compose path.

---

## 8. File Reference Summary

| Component | File | Lines (approx) |
|-----------|------|-----------------|
| Chart generation (server) | `server/index.js` | 370–506, 1085–1126 |
| Ephemeris service (optional) | `services/ephemeris/index.ts` | 1–170 |
| Feature encoding | `vnext/feature-encode.ts` | 1–72 |
| Astro guidance | `vnext/astro/guidance.ts` | 1–76 |
| Plan generator | `vnext/plan-generator.ts` | 1–114 |
| Narrative planner | `vnext/planner/narrative.ts` | 1–148 |
| ML (64→6) | `vnext/ml/index.ts` | 272–330 (studentVector, ensure64) |
| Audition gate | `vnext/audition-gate.ts` | 1–107 |
| Compose API | `vnext/api/compose.ts` | 41–320, 358–395, 498–565 |
| WAV renderer | `vnext/audio/wav-renderer.ts` | 1–29 (stub) |
| Plan → Tone events | `vnext/scheduler.ts` | 22–55 |
| Contracts | `vnext/contracts.ts`, `vnext/explainer/contracts.ts` | — |

---

*End of audit. No code changes were made.*
