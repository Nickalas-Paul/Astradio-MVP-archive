# Audio Generation & Music Composition — Full Repo Audit

**Purpose:** Catalog every file and system that has deterministic or planning influence on the final audio/output delivered to the user. Same inputs must yield same WAV (and plan) for reproducibility.

**Quick reference:** See [AUDIO-COMPOSITION-ONE-PAGER.md](./AUDIO-COMPOSITION-ONE-PAGER.md) for a one-page summary and pipeline diagrams.

---

## 1. Pipeline Overview (Request → WAV)

```
User request (date, time, location/geo)
    → API entry (Next proxy or Express)
    → ComposeAPI.compose()
    → generateControlPayload()  → payload (controls + hash)
    → fetchChartSnapshot()      → EphemerisSnapshot
    → encodeFeatures(snapshot) → FeatureVec[64]
    → generatePlanMLOnly(feat, payload)
        → studentVector(feat)   → v6 [0,1]^6
        → guidanceFromFeatures(feat, snapshot) → AstroGuidance
        → K candidates (base + jitter), planFromVector(v6, guidance) each
        → ruleQualityPass(plan), pick best
    → runAuditionGates(plan, payload.hash)  [can mutate plan: timewarp, trim]
    → renderWav60s(plan, payload, payload.hash) → WAV buffer + sha256
    → Response: audio.base64, audio.sha256, plan, explanation, hashes
```

**Determinism contract:** Same (request → snapshot → payload.hash) and same plan content ⇒ same `plan_sha256` and same `audio.sha256`. No `Math.random` or `Date.now` in plan or render; all variation from seeds (e.g. `payload.hash`).

---

## 2. Files by Layer

### 2.1 Entry & Routing

| File | Role | Determinism impact |
|------|------|--------------------|
| **server/index.js** | Express app; mounts `POST /api/compose` → `vnextCompose`; serves `GET /api/chart-snapshot` (Swiss Ephemeris → EphemerisSnapshot); rate limit/compose limiter. | Request body is passed through; no change to plan/audio. Chart snapshot is deterministic from (date, time, lat, lon). |
| **apps/web/app/api/compose/route.ts** | Next.js API route: validates body, converts to `mode: 'sky'` with `skyParams: { latitude, longitude, datetime }`, proxies to `API_BASE_URL/api/compose`. | **Determinism:** Request shape and defaulting (date, time, lat/lon) define what the backend receives. Same client input ⇒ same proxy request. |

- **Chart snapshot source:** `server/index.js` `GET /api/chart-snapshot` (Swiss Ephemeris: positions, cusps, aspects, moonPhase, dominantElements). Used by ComposeAPI as sole source of EphemerisSnapshot for feature encoding in compose().

---

### 2.2 Compose API (Orchestration)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/api/compose.ts** | ComposeAPI: `generateControlPayload()` (mode → payload), `fetchChartSnapshot()`, `generatePlanMLOnly()`, `runAuditionGates()`, text explainer, WAV render, MIDI optional, response shape. | **Critical.** Payload hash = `generateHash(payload)` (deterministic from payload JSON). Seed for plan/audio = `payload.hash`. Caching key = `sha256(JSON.stringify(request) + runtimeModel)`. Plan and WAV are not cached by plan hash; cache is by request key. |

- **Payload hash:** `generateHash(data)` = integer hash of `JSON.stringify(data)` → hex string. Used as `payload.hash` and as seed for renderer and plan-generator RNG.
- **Modes:** `sandbox` (user controls + defaults → merged payload + hash), `sky` (astro + student inference → payload + hash), `overlay`, `compatibility`. Each mode yields a deterministic payload for the same inputs.

---

### 2.3 Feature Encoding (Snapshot → Vector)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/feature-encode.ts** | `encodeFeatures(s: EphemerisSnapshot): FeatureVec` — 64-dim Float32: planets (0–9), houses (10–21), aspect counts (22–26), elements (27–30), moonPhase (31), tension/cluster (32–33), pad 34–63. Clamps and scrubs NaN. | **Fully deterministic.** Same snapshot ⇒ same FeatureVec. No randomness. |

- **vnext/contracts.ts** — `EphemerisSnapshot`, `FeatureVec` (length 64), `EventToken`, `Plan`. Defines the data shapes; no logic.

---

### 2.4 ML Inference (Vector → v6)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/ml/index.ts** | `studentVector(feat: FeatureVec)`: loads TFJS model (student-v2.2 or RUNTIME_MODEL), runs single forward pass, returns 6-dim vector in [0,1]. Uses `resolveModelDir()`, fs or HTTP loader, `StudentV2Adapter` (passthrough, shape [6]). | **Deterministic for same model + input.** Same FeatureVec ⇒ same vector (TF inference is deterministic). Model path from env/cwd/dist. |

- Model location: `VNEXT_MODEL_PATH` > `dist/models/student-v2.2` > `models/student-v2.2`. Checksum logged as `model_sha`.

---

### 2.5 Astro Guidance (Chart → Planner Biases)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/astro/guidance.ts** | `guidanceFromFeatures(featureVec, chartContext)`: tempoBias, arcBias, densityBias from elements/tension/cluster; motifIdx from sun sign; cadenceIdx from moon phase. Pure function. | **Deterministic.** Same features + snapshot ⇒ same AstroGuidance. Drives narrative planner biases. |

---

### 2.6 Plan Generation (v6 + Payload → Plan)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/plan-generator.ts** | `generatePlanMLOnly(feat, chartContext)`: calls `studentVector(feat)` → base v6; builds RNG from `chartContext.hash` (or payload.hash); generates K candidates (base + jitter with `VNEXT_JITTER`); for each runs `planFromVector(v6, guidanceWithSeed)` and `ruleQualityPass(plan)`; picks best by score. Throws if best below `MIN_RULE_QUALITY`. | **Determinism:** RNG seeded by `chartContext.hash` (payload.hash in compose flow). Same feat + same payload hash ⇒ same candidate set and same chosen plan. Env: `VNEXT_K`, `VNEXT_JITTER`, `MIN_RULE_QUALITY` from config. |
| **vnext/planner/narrative.ts** | `planFromVector(v6, guidance?)`: bpm, baseCenter, phraseCenters from v6; motifIdx/cadenceIdx from guidance or v6; density, progId; 16 bars, 4 phrases, A A' B A; melody from hook templates + cadence + chord-tone resolution; bass (pattern 0 or 1, diatonic approach); harmony (inversions by voice-leading); rhythm. Output: `Plan` (id, featureHash, durationSec, bpm, key, events). | **Fully deterministic.** No Math.random/Date. Same (v6, guidance) ⇒ same Plan.events. Defines note choice, timing, channel, velocity. |
| **vnext/config/quality.ts** | `MIN_RULE_QUALITY`, thresholds for critics and audition. | Plan is rejected if rule quality below threshold; does not change plan content, only accept/reject. |

- **vnext/audition-gate.ts** — `audition(plan)`: min events, channels, timewarp to 60s, overlap trim. **Can mutate plan** (timewarp, trim). `ruleQualityPass(plan)` uses critics; used in plan-generator for rerank and in audition for pass/fail.

---

### 2.7 Critics (Plan Scoring Only)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/critics/index.ts** | `scoreMelody`, `scoreHarmony`, `scoreRhythm`: arc, motif, contour, step-leap, range, voice-leading, syncopation, etc. Used by `ruleQualityPass` and gate report. | **Read-only on plan.** Pure scoring. Influences which candidate is chosen and gate pass/fail; does not alter events. |

---

### 2.8 Plan Hash & Canonical Form

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/plan-hash.ts** | `canonicalizePlan(plan)`: sort events by (t0, channel, pitch, t1, velocity, group), round times to 1ms; `computePlanHash(plan)`: SHA256 of canonical JSON. | **Defines canonical plan identity.** Same logical plan ⇒ same hash. Used in response `plan_sha256` and for verification. |

---

### 2.9 WAV Renderer (Plan + Seed → PCM)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/audio/wav-renderer.ts** | `renderWav60s(plan, payload, hash, options)`: seed = hash or payload.hash; `buildWav(seed, plan, sampleRate, channels)`: if humanize on, `getPerformanceParams(seed, bpm)` (jitter, swing, velocity, articulation, ADSR, spatial), per-event timing/velocity/ADSR/pan, optional reverb; then 60s float buffers, normalize, write 16-bit PCM WAV. | **Deterministic:** same plan + same hash ⇒ same buffer and sha256. All variation from seed+key PRNG (`rand01`/`randSigned`). No Math.random/Date. Env: `VNEXT_HUMANIZE`, `ENABLE_WAV_EXPORT` (compose only gates whether WAV is generated). |

- Humanization: micro-timing, swing (rhythm/short melody), phrase gap (melody/harmony), velocity curve/accents, ADSR per channel, pan, short reverb. All keyed by seed + stable keys (channel, eventIndex, bar, etc.).

---

### 2.10 MIDI Export (Plan → MIDI Bytes)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/midi/plan-to-midi.ts** | `planToMidiBase64(plan)`: tempo from plan.bpm, one track per channel (melody, harmony, bass, rhythm), events sorted canonically, t0/t1 → ticks via PPQ 480. | **Deterministic.** Same plan ⇒ same MIDI bytes. Optional in response. |

---

### 2.11 Client-Side Playback (Plan → Tone.js)

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/client/plan-to-tone-events.ts** | `planToToneEvents(plan)`: Plan.events → ToneEvent[] (time, note name, duration, velocity, channel). Used in browser when WAV not available (fallback). | **Deterministic.** Same plan ⇒ same Tone events. Playback sound depends on Tone.js and browser; not part of “delivered file” (WAV is the delivered file). |

- **apps/web/app/page.tsx** — Home: POST /api/compose (via getApiBaseUrl() + '/api/compose'), then uses `payload.audio.url` or `payload.audio.base64` for playback, or `payload.plan` with Tone fallback. Does not alter plan or audio.

---

### 2.12 Text Explainer

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/explainer/** (text-explainer, atoms-generator, mapping-tables-v1.json, etc.) | Generates explanation text from payload + gate report. | **No effect on plan or WAV.** Only on response.explanation. |

---

### 2.13 Compatibility / Comparisons

| File | Role | Determinism impact |
|------|------|--------------------|
| **vnext/compat/** (comparison-service, payload-from-seed, routes) | Community/comparison flows; can call compose with features + payload. | Uses same `generatePlanMLOnly` + `renderWav60s`; same determinism rules. |
| **vnext/api/compose.ts** `composeFromFeatures(featureVec, payload)` | Used by e.g. POST /api/comparisons. Same pipeline: plan → gates → explainer → WAV. | Same plan/audio determinism as main compose(). |

---

## 3. Environment & Config That Affect Output

- **VNEXT_HUMANIZE** — Renderer: `0` = legacy flat envelope; default = humanization on. Same plan+hash with same env ⇒ same WAV.
- **ENABLE_WAV_EXPORT** — Compose: `1` = generate WAV and include in response; otherwise stub. Does not change plan.
- **VNEXT_K** — Plan generator: number of candidates (default 8).
- **VNEXT_JITTER** — Plan generator: jitter sigma for candidates (default 0.10).
- **MIN_RULE_QUALITY** / **vnext/config/quality.ts** — Threshold for accepting best candidate; can cause 422 if all below.
- **VNEXT_DEBUG_CHORD** — Narrative: when `1`, logs chord/bass/sustained melody per bar; no change to events.
- **RUNTIME_MODEL** / **VNEXT_MODEL_PATH** — ML model path/version; same model + same FeatureVec ⇒ same v6.
- **API_BASE_URL** / **ENGINE_BASE_URL** — Next compose route: target of proxy; does not change backend logic.

---

## 4. Data Flow Summary (Deterministic Chain)

1. **Request** → (date, time, lat, lon) from body or skyParams.
2. **Chart** → `GET /api/chart-snapshot` (server) → EphemerisSnapshot (deterministic from date, time, lat, lon).
3. **Payload** → generateControlPayload(mode, request) → ControlSurfacePayload with `hash` = generateHash(...).
4. **Features** → encodeFeatures(snapshot) → FeatureVec[64] (deterministic).
5. **v6** → studentVector(featureVec) → [6] (deterministic for same model + input).
6. **Guidance** → guidanceFromFeatures(featureVec, snapshot) (deterministic).
7. **Plan** → generatePlanMLOnly(feat, payload): RNG(seed=payload.hash), K candidates, planFromVector(v6, guidance), best by ruleQualityPass (deterministic for same seed + feat).
8. **Gates** → audition(plan) may timewarp/trim plan (deterministic given plan).
9. **Plan hash** → computePlanHash(plan) (deterministic).
10. **WAV** → renderWav60s(plan, payload, payload.hash): seed = payload.hash, buildWav with PerformanceParams(seed, bpm), humanization keyed by seed (deterministic).
11. **Response** → audio.base64, audio.sha256, plan_sha256, explanation, etc.

**Files that directly determine the delivered audio file (WAV):**

- **vnext/contracts.ts** — Plan/EventToken shape.
- **vnext/feature-encode.ts** — Snapshot → FeatureVec.
- **vnext/ml/index.ts** — FeatureVec → v6.
- **vnext/astro/guidance.ts** — Guidance from features/snapshot.
- **vnext/plan-generator.ts** — v6 + payload → Plan (candidate generation + selection).
- **vnext/planner/narrative.ts** — v6 + guidance → Plan.events (all note/timing/channel/velocity choices).
- **vnext/audition-gate.ts** — Plan validation and optional timewarp/trim.
- **vnext/plan-hash.ts** — Canonical plan form (used for identity, not for rendering).
- **vnext/audio/wav-renderer.ts** — Plan + seed (payload.hash) → 60s WAV buffer and sha256.

**Files that affect whether/how the user gets that file (no change to WAV content):**

- **vnext/api/compose.ts** — Orchestration, payload hash, seed passed to renderer, ENABLE_WAV_EXPORT gating.
- **server/index.js** — /api/compose route, /api/chart-snapshot.
- **apps/web/app/api/compose/route.ts** — Request shaping and proxy to backend.

---

## 5. Test & Verification Scripts (Determinism)

- **vnext/scripts/audio-renderer-determinism.ts** — Two renders, same plan+payload → assert same sha256.
- **vnext/scripts/compose-determinism-soak.ts** — N compose runs with fixed request; assert same audio.sha256 and gate pass.
- **vnext/scripts/compose-audio-contract-test.ts** — Compose with mocked chart-snapshot; contract assertions.
- **vnext/scripts/audio-sanity.ts** — WAV structure, peak, channel count.
- **vnext/scripts/test-plan-hash.ts** — Canonical hash stability.
- **vnext/scripts/test-midi-determinism.ts** — Same plan ⇒ same MIDI.

---

*Audit date: 2025-02-07. Pipeline: Chart → Features → ML v6 → planner/narrative.ts → Plan.events → audition-gate (optional timewarp/trim) → wav-renderer.ts → 60s WAV. Determinism: same plan + same payload.hash ⇒ identical WAV bytes/sha256.*
