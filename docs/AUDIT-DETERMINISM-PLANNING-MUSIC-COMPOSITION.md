# Audit: Determinism, Planning & Music Composition (Astro → Music)

Full audit of all components that translate astrological data into music output: deterministic behavior, planning, and audio writing.

---

## 1. End-to-end pipeline (astro → music)

```
Request (mode, chartData/skyParams, controls)
    │
    ├─► fetchChartSnapshot(request)     → EphemerisSnapshot
    │
    ├─► generateControlPayload(request) → ControlSurfacePayload (includes .hash)
    │
    ▼
encodeFeatures(snapshot)               → FeatureVec (64 dims)
    │
    ▼
generatePlanMLOnly(featureVec, payload)
    │
    ├─► studentVector(featureVec)       → v6 [6] (ML)
    ├─► guidanceFromFeatures(feat, snapshot*) → AstroGuidance (*snapshot built from payload in plan-generator)
    ├─► guidanceWithSeed = { ...guidance, seed: payload.hash }
    ├─► candidates = [base, jitter(base, JITTER, rng)]  // rng = createSeededRNG(payload.hash)
    ├─► for each candidate: planFromVector(v6, guidanceWithSeed) → Plan
    ├─► ruleQualityPass(plan) → score; pick best plan
    │
    ▼
Plan (id, featureHash, durationSec, bpm, key, events[])
    │
    ├─► runAuditionGates(plan, payload.hash)  → GateReport (deterministic from seed)
    ├─► renderWav60s(plan, payload, payload.hash) → WAV buffer + sha256
    └─► planToMidiBase64(plan)                → MIDI base64 + sha256
```

---

## 2. Astrological data → features

### 2.1 EphemerisSnapshot (contract)

**File:** `vnext/contracts.ts`

- **Type:** `EphemerisSnapshot` — chart snapshot: `ts`, `tz`, `lat`, `lon`, `houseSystem`, `planets[]`, `houses[12]`, `aspects[]`, `moonPhase`, `dominantElements`.
- Used as the single chart representation for feature encoding and (when available) astro guidance.

### 2.2 Feature encoding (astro → vector)

**File:** `vnext/feature-encode.ts`  
**Function:** `encodeFeatures(s: EphemerisSnapshot): FeatureVec`

- **Deterministic:** Pure function; same snapshot ⇒ same 64-dim vector.
- **Feature layout:**
  - `0–9`:   Planet longitudes (normalized 0–1), order: sun, moon, mercury, venus, mars, jupiter, saturn, uranus, neptune, pluto.
  - `10–21`: House cusps (normalized).
  - `22–26`: Aspect counts (conjunction, sextile, square, trine, opposition), clamped to [0,1].
  - `27–30`: Element dominance (fire, earth, air, water).
  - `31`:    Moon phase.
  - `32`:    Tension heuristic (squares/oppositions).
  - `33`:    Cluster density (planets).
  - `34–63`: Zero-padded; NaN/Inf scrubbed to 0.
- **Output:** `FeatureVec` = `Float32Array` length 64.

---

## 3. Astro guidance (features + chart → biases)

**File:** `vnext/astro/guidance.ts`  
**Function:** `guidanceFromFeatures(featureVec, chartContext: EphemerisSnapshot): AstroGuidance`

- **Deterministic:** Pure; same inputs ⇒ same guidance.
- **Inputs:** Same `FeatureVec` from encoding; `chartContext` is used for sun/moon (in plan-generator this is built from `chartContext`/payload when provided).
- **Output:** `AstroGuidance`:
  - **tempoBias** [−1, 1]: fire+air vs earth+water (indices 27–30).
  - **arcBias** [−1, 1]: tension (index 32).
  - **densityBias** [−1, 1]: cluster density (index 33).
  - **motifIdx** [0–7]: sun longitude / 30 (from `chartContext.planets`).
  - **cadenceIdx** [0–1]: moon phase &lt; 0.5 ⇒ 0 else 1 (index 31).
- **Optional:** `applyGuidanceBias(baseVector, guidance)` returns a biased v6-style vector (used for documentation; narrative applies biases internally).

---

## 4. ML: feature vector → v6 (plan controls)

**File:** `vnext/ml/index.ts`  
**Function:** `studentVector(feat: FeatureVec): Promise<StudentVectorResult>`

- **Input:** 64-dim `FeatureVec` (padded to 64 if needed).
- **Process:** TensorFlow.js model (student-v2.2): single forward pass, deterministic for same weights and input.
- **Output:** `vector` (v6): **6 dimensions** in [0, 1], used as:
  - **v[0]** tempo
  - **v[1]** brightness/register
  - **v[2]** density
  - **v[3]** arc height
  - **v[4]** motif selection
  - **v[5]** cadence selection
- **Determinism:** Same `feat` and same loaded model ⇒ same `vector`. No randomness in inference.
- **Metadata:** `modelVersion`, `model_sha`, `tf_backend`, `inference_ms`, `ml_used`.

---

## 5. Plan generation (v6 + guidance → Plan)

**File:** `vnext/plan-generator.ts`  
**Function:** `generatePlanMLOnly(feat, chartContext?: any): Promise<{ plan, source, diag }>`

- **Seed:** `seedStr = chartContext?.hash ?? chartContext?.controls?.hash ?? "seed"` (controls.hash / payload.hash in compose).
- **RNG:** `createSeededRNG(seedStr)` — xorshift32, deterministic.
- **Candidates:** `[base, jitter(base, JITTER, rng), …]` with `K` (default 8) candidates; jitter sigma = `VNEXT_JITTER` (default 0.10).
- **Guidance:** If `chartContext` present, build ephemeris-shaped snapshot and call `guidanceFromFeatures(feat, snapshot)`; then `guidanceWithSeed = { ...guidance, seed: seedStr }`.
- **Scoring:** For each candidate v6, `plan = planFromVector(v6, guidanceWithSeed)`, `ruleQualityPass(plan)`; sort by score descending; pick best.
- **Gate:** If best score &lt; `MIN_RULE_QUALITY` (0.55 from `config/quality`), throw (422).
- **Determinism:** Same `feat`, same `chartContext` (hence same `payload.hash` and snapshot) ⇒ same seed ⇒ same jitter sequence and same chosen plan.

---

## 6. Narrative planner (v6 + guidance → Plan.events)

**File:** `vnext/planner/narrative.ts`  
**Function:** `planFromVector(v: V6, guidance?): Plan`

- **Deterministic:** No `Date.now`, no `Math.random`; same `(v, guidance)` ⇒ identical `Plan.events` and thus same plan hash / WAV / MIDI.
- **Constants:** `BARS=16`, `PHRASE=4`, `DUR_SEC=60`, 16th-note grid (`GRID_16=4`).
- **v6 usage:**
  - **v[0]** → BPM (lerp 70–140) with `guidance.tempoBias`.
  - **v[1]** → `baseCenter` (lerp 55–67).
  - **v[2]** → density (lerp 0.3–0.9) with `guidance.densityBias`.
  - **v[3]** → arc lift (lerp 3–10) with `guidance.arcBias` → `phraseCenters[4]`.
  - **v[4]** → motif index (or `guidance.motifIdx`) → contour template.
  - **v[5]** → cadence index (or `guidance.cadenceIdx`) → `cadencePitch`.
- **Plan id:** `guidance.seed` (first 32 chars) if present; else `plan_v6_${bpm}_${baseCenter}_${motifIdx}_${cadenceIdx}_${phraseCenters.join("_")}`.
- **Time:** All event `t0`/`t1` from `quantizeTo16th(timeSec, bpm)`; if `t1 ≤ t0`, set `t1 = t0 + one16thSec`.
- **Phrase roles:** Per 4-bar phrase: bar 0 motif, 1 variation, 2 tension, 3 cadence.
- **Harmony:** Fixed i–VI–V–i per phrase (roots 57, 53, 52, 57 MIDI); triads from `PROG_TRIADS`.
- **Melody:** Contour templates by `motifIdx` and role; scale degrees → semitones; register arc; cadence bar last note = `cadencePitch`.
- **Bass:** Chord roots from progression (root + fifth per bar).
- **Rhythm:** Kick 1 & 3, hat 2 & 4; 16th-aligned, min duration one 16th.
- **Output:** `events` sorted by `t0`, then channel, then pitch.

---

## 7. Quality gate (plan → pass/fail)

**File:** `vnext/audition-gate.ts`

- **audition(plan, cfg):** Min events, required channels (melody, harmony), non-finite check, optional timewarp to target duration, overlap trim; then `ruleQualityPass(plan)`.
- **ruleQualityPass(plan):** Uses critics (see below); thresholds in `THRESH` (arc, motif, contour, stepLeap, range, harmony, rhythm, duration_variety, density_curve); gaming penalty on melody; overall score from melody/harmony/rhythm.
- **Determinism:** No randomness; same plan ⇒ same result.

**File:** `vnext/critics/index.ts`

- **scoreMelody(plan):** Arc, motif recurrence, contour entropy, step/leap, range, narrative flow, gaming penalty (deterministic from plan).
- **scoreHarmony(plan):** progression_legality, voice_leading, tension, complexity, resolution — deterministic placeholders from chord/event data.
- **scoreRhythm(plan):** syncopation, groove, tempo, diversity, accent, duration_variety, density_curve — deterministic; durations from `t1−t0`.

---

## 8. Plan hashing (canonical identity)

**File:** `vnext/plan-hash.ts`

- **roundTime(t):** Round to 1 ms.
- **compareEvents(a,b):** t0 → channel → pitch → t1 → velocity → group (deterministic order).
- **canonicalizePlan(plan):** Sort events by `compareEvents`, round times, output stable JSON shape (id, featureHash, durationSec, bpm, key, events).
- **computePlanHash(plan):** SHA256 of `JSON.stringify(canonicalizePlan(plan))`.
- **Determinism:** Same plan ⇒ same hash; used in compose response as `plan_sha256`.

---

## 9. WAV renderer (plan → 60s audio)

**File:** `vnext/audio/wav-renderer.ts`  
**Function:** `renderWav60s(planInput, payloadInput, hash, options?): RenderResult`

- **Seed:** `hash` or `payload.hash` or `plan.featureHash` or `"default"`.
- **buildWav(seed, plan, sampleRate, channels):** 60 s, 16-bit PCM; events from `plan.events` (sorted by t0); sine tones from t0, t1, pitch, velocity; normalization; no randomness in event rendering.
- **Determinism:** Same plan and same effective seed ⇒ same buffer ⇒ same `sha256` in `RenderResult`.
- **Output:** `buffer`, `sha256`, `duration_ms`, `size_bytes`.

---

## 10. MIDI export (plan → MIDI bytes)

**File:** `vnext/midi/plan-to-midi.ts`  
**Function:** `planToMidiBase64(plan): { base64, sha256, ppq, tracks, bytes }`

- **Deterministic:** Same plan ⇒ same MIDI bytes and sha256.
- **Process:** One track per channel (melody, harmony, bass, rhythm); events sorted (t0, pitch, t1); `roundTime` to 1 ms; seconds → ticks via `plan.bpm` and PPQ 480; pitch clamped 0–127; velocity 0–1 → 1–127.
- **Output:** MIDI file bytes, SHA256 of bytes, base64.

---

## 11. Compose API (orchestration)

**File:** `vnext/api/compose.ts`

- **Request key (cache):** `sha256(JSON.stringify(request) + runtimeModel)` — idempotency; same request ⇒ cache hit.
- **Payload:** `generateControlPayload(request)` → for sandbox, `generateSandboxPayload(controls)` → merged payload, then `payload.hash = generateHash(mergedPayload)`. `generateHash` is deterministic (integer hash of `JSON.stringify(data)`).
- **Snapshot:** `fetchChartSnapshot(request)` — from `/api/chart-snapshot` (or mock in soak); used only for `encodeFeatures(snapshot)` → `featureVec`. Snapshot is **not** passed into `generatePlanMLOnly`; plan-generator builds an ephemeris-like object from `chartContext` (payload) for `guidanceFromFeatures` when needed.
- **Flow:** snapshot → featureVec; payload (with hash) → generatePlanMLOnly(featureVec, payload); plan → runAuditionGates(plan, payload.hash); renderWav60s(plan, payload, payload.hash); optional planToMidiBase64(plan).
- **Hashes in response:** control, audio (WAV sha256), explanation, viz, plan_sha256, optional midi_sha256.
- **runAuditionGates(plan, seed):** Uses seeded RNG from `seed` for mock gate scores (calibrated/strict thresholds); same plan + seed ⇒ same report.
- **Session/request IDs:** `generateSessionId()` / `generateRequestId()` use `Date.now()` — not part of plan/audio determinism.

---

## 12. Configuration affecting determinism & quality

**File:** `vnext/config/quality.ts`  
- `MIN_RULE_QUALITY` (0.55 dev): plan-generator rejects if best candidate below this.  
- `THRESH` in audition-gate (see §7).

**File:** `vnext/config/reproducibility.ts`  
- Seeds and checksums for training/validation; not used in runtime plan/audio path.

**Environment (plan-generator):**  
- `VNEXT_K` (candidates), `VNEXT_JITTER` (jitter sigma). Same seed ⇒ same candidate set and ranking.

---

## 13. Data contracts (summary)

| Type | File | Role |
|------|------|------|
| EphemerisSnapshot | contracts.ts | Chart input to encodeFeatures and guidance |
| FeatureVec | contracts.ts | 64-dim input to ML and guidance |
| EventToken | contracts.ts | t0, t1, pitch, velocity, channel [, group] |
| Plan | contracts.ts | id, featureHash, durationSec, bpm, key, events[] |
| AstroGuidance | astro/guidance.ts | tempoBias, arcBias, densityBias, motifIdx, cadenceIdx |

---

## 14. Determinism summary

| Component | Deterministic from | Notes |
|-----------|--------------------|--------|
| encodeFeatures | EphemerisSnapshot | Pure function |
| guidanceFromFeatures | FeatureVec, EphemerisSnapshot | Pure function |
| studentVector | FeatureVec | TF inference, fixed weights |
| createSeededRNG | seed string | xorshift32 |
| jitter | base vector, sigma, rng | Same rng ⇒ same jitter |
| planFromVector | v6, guidance | No Date.now / Math.random |
| ruleQualityPass / critics | Plan | Deterministic scorers |
| canonicalizePlan / computePlanHash | Plan | Canonical sort + SHA256 |
| renderWav60s | plan, hash | Same plan + hash ⇒ same WAV |
| planToMidiBase64 | Plan | Same plan ⇒ same MIDI |
| runAuditionGates | plan, seed | Seeded RNG for mock scores |
| Compose cache key | request + runtimeModel | Same request ⇒ same cached response |

**End-to-end:** Same request (including chart data and controls) ⇒ same snapshot ⇒ same featureVec ⇒ same v6 (and guidance if context matches) ⇒ same seed ⇒ same candidates and best plan ⇒ same plan hash, WAV sha256, and MIDI sha256.

---

## 15. Files reference (vnext, non-exhaustive)

| Path | Purpose |
|------|--------|
| contracts.ts | Plan, EventToken, FeatureVec, EphemerisSnapshot |
| feature-encode.ts | EphemerisSnapshot → FeatureVec (64) |
| astro/guidance.ts | FeatureVec + snapshot → AstroGuidance |
| ml/index.ts | FeatureVec → v6 (studentVector) |
| plan-generator.ts | featureVec + payload → Plan (candidates, jitter, quality gate) |
| planner/narrative.ts | v6 + guidance → Plan (events, 16th grid, i–VI–V–i, contours) |
| audition-gate.ts | audition(), ruleQualityPass() |
| critics/index.ts | scoreMelody, scoreHarmony, scoreRhythm |
| plan-hash.ts | canonicalizePlan, computePlanHash |
| audio/wav-renderer.ts | renderWav60s(plan, payload, hash) |
| midi/plan-to-midi.ts | planToMidiBase64(plan) |
| api/compose.ts | Request → snapshot, payload, plan, gates, WAV, MIDI, hashes |
| config/quality.ts | MIN_RULE_QUALITY, thresholds |
| config/reproducibility.ts | Training/split seeds, checksums |

---

*Audit covers the main vnext codebase; duplicate or legacy paths (e.g. under Astradio_VNEXT) follow the same concepts where present.*
