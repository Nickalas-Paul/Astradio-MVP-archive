# Music Production Pipeline — Comprehensive Audit Report
**Date:** 2026-02-11  
**Branch:** beta-ui-vercel  
**Scope:** Complete end-to-end pipeline from chart request to audio output, including all recent additions (Personality Profile v1, Performance Layer v2, Instrumentation v1/v2, Mix Balance, FX Routing, Bass Sub+Mid)

---

## Executive Summary

The music production pipeline is **deterministic**, **well-structured**, and **additive** (no breaking changes). Recent additions (Personality Profile, Performance Layer v2, Instrumentation stack, Provenance, Genre) integrate cleanly without disrupting existing flows. The **audio renderer** has evolved through six additive upgrades: Instrumentation v1, Mix Balance v1, FX Routing v1, Bass Sub+Mid v1, and Instrumentation v2 (band-limited synthesis + reverb send bus).

**Pipeline health:** ✅ **Good**  
**Redundancies:** ⚠️ **1 identified** (legacy feature encoder - **confirmed unused, safe to remove**)  
**Determinism:** ✅ **Verified** (same inputs → same outputs)  
**Test coverage:** ✅ **Comprehensive** (9 music/audio verification scripts)

### Quick Reference

| Stage | Primary File | Input | Output | Determinism |
|-------|--------------|-------|--------|-------------|
| **Chart** | `server/index.js` | date/time/lat/lon | EphemerisSnapshot | ✅ |
| **Features** | `vnext/feature-encode.ts` | EphemerisSnapshot | FeatureVec[64] | ✅ |
| **ML** | `vnext/ml/index.ts` | FeatureVec[64] | v6[6] | ✅ |
| **Guidance** | `vnext/astro/guidance.ts` | FeatureVec + Snapshot | AstroGuidance + PersonalityProfileV1 | ✅ |
| **Plan** | `vnext/plan-generator.ts` + `vnext/planner/narrative.ts` | v6 + Guidance + payload.hash | Plan.events | ✅ |
| **Gates** | `vnext/audition-gate.ts` | Plan | Plan (may mutate) | ✅ |
| **WAV** | `vnext/audio/wav-renderer.ts` | Plan + payload.hash | 60s PCM + audio.sha256 | ✅ |

**Total core files:** 12  
**Total music/audio test scripts:** 9  
**Redundancies:** 1 (legacy encoder - unused)

---

## 1. Complete Pipeline Diagram

```mermaid
flowchart TB
    subgraph Input["📥 Input Layer"]
        R[User Request<br/>date, time, lat, lon, mode]
        R --> CP[generateControlPayload]
        R --> CS[fetchChartSnapshot]
    end

    subgraph Chart["🌌 Chart Generation"]
        CS --> SE[Swiss Ephemeris<br/>server/index.js]
        SE --> SN[EphemerisSnapshot<br/>ts, planets, houses, aspects, moonPhase, elements]
        SN --> ENC[encodeFeatures<br/>vnext/feature-encode.ts]
        ENC --> F64[FeatureVec[64]<br/>planets 0-9, houses 10-21, aspects 22-26,<br/>elements 27-30, moonPhase 31, tension 32, cluster 33]
    end

    subgraph ML["🤖 ML Inference"]
        F64 --> ML_MODEL[studentVector<br/>vnext/ml/index.ts]
        ML_MODEL --> V6[v6[6]<br/>tempo, bright, dense, arc, motif, cadence]
    end

    subgraph Guidance["🔮 Astro Guidance"]
        F64 --> GUID[guidanceFromFeatures<br/>vnext/astro/guidance.ts]
        SN --> GUID
        GUID --> ASTRO[AstroGuidance<br/>tempoBias, arcBias, densityBias,<br/>motifIdx, cadenceIdx, elementBlend,<br/>motionProfile, narrativeArc]
        GUID --> PP[PersonalityProfileV1<br/>temperament, subsystems, emphasis, reveal]
    end

    subgraph PlanGen["📝 Plan Generation"]
        CP --> PAY[ControlSurfacePayload<br/>+ hash + genre]
        V6 --> PG[generatePlanMLOnly<br/>vnext/plan-generator.ts]
        PAY --> PG
        ASTRO --> PG
        PP --> PG
        PG --> CAND[K candidates<br/>base + jitter]
        CAND --> PLAN_VEC[planFromVector<br/>vnext/planner/narrative.ts]
        PLAN_VEC --> PLAN[Plan<br/>id, bpm, key, events[]]
        PLAN --> QUALITY[ruleQualityPass<br/>vnext/critics/index.ts]
        QUALITY --> BEST[Best Plan Selected]
    end

    subgraph Narrative["🎵 Narrative Planner Details"]
        PLAN_VEC --> MEL[Melody<br/>HOOK_TEMPLATES, motif repetition,<br/>house: call/response]
        PLAN_VEC --> HAR[Harmony<br/>triads, inversions, voice-leading,<br/>house: chord stabs in Recognition]
        PLAN_VEC --> BAS[Bass<br/>tonic-dominant patterns,<br/>house: syncopated pickups]
        PLAN_VEC --> RHY[Rhythm<br/>kick/hat patterns,<br/>house: 4-on-floor + clap]
    end

    subgraph Gates["🚪 Audition Gates"]
        BEST --> GATE[audition gate<br/>vnext/audition-gate.ts]
        GATE --> TW[Timewarp/Trim<br/>optional plan mutation]
        TW --> PLAN_FINAL[Final Plan]
    end

    subgraph Render["🎚️ Audio Rendering"]
        PLAN_FINAL --> HASH[computePlanHash<br/>vnext/plan-hash.ts]
        HASH --> PLAN_SHA[plan_sha256]
        PLAN_FINAL --> WAV[renderWav60s<br/>vnext/audio/wav-renderer.ts]
        PAY --> WAV
        WAV --> PERF[Performance Layer v2<br/>phrase envelope, rubato, velocity arc]
        WAV --> INST[Instrumentation v1+v2<br/>polyBLEP, sub+mid bass, FX sends]
        PERF --> PCM[60s PCM Buffer<br/>16-bit, 22050Hz, mono/stereo]
        INST --> PCM
        PCM --> AUDIO_SHA[audio.sha256]
    end

    subgraph Output["📤 Output"]
        PLAN_FINAL --> MIDI[planToMidiBase64<br/>optional]
        PCM --> BASE64[WAV base64]
        PLAN_SHA --> RESP[ComposeResponse]
        AUDIO_SHA --> RESP
        BASE64 --> RESP
        RESP --> PROV[Provenance Object<br/>snapshot_sha256, featurevec_sha256,<br/>v6_sha256, model_id, model_sha,<br/>plan_sha256, audio_sha256, payload_hash]
    end

    style SN fill:#e3f2fd
    style F64 fill:#fff3e0
    style V6 fill:#f3e5f5
    style PLAN fill:#e8f5e9
    style PCM fill:#fce4ec
    style PROV fill:#e0f2f1
```

---

## 2. Detailed Pipeline Stages

### Stages 1–7 (Input → Plan)

*Unchanged from previous audit. See original sections 2.1–2.7 for Chart, Features, ML, Guidance, Plan, Narrative, Gates.*

---

### Stage 8: Audio Rendering — Full Stack

**File:** `vnext/audio/wav-renderer.ts` (`renderWav60s`)

The audio renderer is a **layered stack** of additive upgrades. All layers use seeded PRNG (`payload.hash` + stable keys); no `Math.random` or `Date.now`.

#### 8.1 Performance Layer v2
- **Phrase envelope:** 4 phrases over 16 bars; velocity arc (rise/peak/fall) + breath dip at phrase end
- **Rubato:** Seeded t0 shift (±4ms) near phrase boundaries; release lengthening (×1–1.25) for notes ending near phrase end
- **Humanization:** Micro-timing, swing, velocity dynamics, ADSR per channel, pan
- **Legato:** Release extension when next same-channel note is within overlap window

#### 8.2 Instrumentation Layer v1
- **Instrument palette:** `getInstrumentPalette(genre, seed)` — per-channel params for kick, hat, clap, bass, harmony, melody
- **Synthesis:**
  - **Kick:** Sine with pitch drop (120→45 Hz) + click transient + saturation
  - **Hat:** Highpassed noise (6–10 kHz)
  - **Clap:** Filtered noise + room reflection (ring buffer)
  - **Bass:** See 8.4
  - **Harmony:** Stab (sine) + lowpass sweep + stereo widen
  - **Melody:** Pluck (sine) + vibrato
- **Genre:** `payload.genre` (default `"house"`)

#### 8.3 Mix Balance v1
- **Sidechain duck:** Envelope-based duck on bass (depth 0.22) and harmony (0.10) from kick onsets; fast attack, short hold, fast recovery
- **Master bus:** Gentle compression (thr 0.4, ratio 3) + light soft clip (tanh)
- **EQ:** HPF 50 Hz + LPF 14 kHz on mix

#### 8.4 Bass Sub+Mid v1 (Option A)
- **Two-layer bass:** Sub anchor (70–85% energy) + mid character (15–30%)
- **Sub:** Sine, LPF 120 Hz, attack 8–15 ms, release 180–320 ms, near-zero saturation
- **Mid:** polyBLEP saw/square (seeded), ±3 cents detune, LPF 700–1100 Hz, saturation 0.02–0.06 after LPF, faster release (0.7–0.85× sub)
- **Combined:** HPF 35–40 Hz on sum; sidechain duck on combined; **fully mono, zero reverb send**

#### 8.5 FX Routing v1
- **Send buses:** ROOM (short), PLATE (longer), DELAY
- **Send matrix:** bass/kick/hat → 0; clap → ROOM (0.28–0.42); harmony → PLATE (0.08–0.16); melody → PLATE (0.05–0.11) + DELAY (0.03–0.08)
- **Bass:** Fully dry; no reverb, no stereo widen
- **Return duck:** 18% depth on reverb returns from kick onsets (2 ms attack, 35 ms recovery)

#### 8.6 Instrumentation v2 (Band-limited + Reverb Bus)
- **PolyBLEP:** Band-limited saw and square oscillators for bass mid layer; reduces aliasing at 22k/44k
- **Reverb input filtering:** HPF 180–260 Hz (seeded), LPF 7–10 kHz (seeded); prevents bass bloom and harsh fizz
- **Pre-delay:** 15–30 ms (seeded) on room, plate, delay inputs
- **reverbSendAmounts:** Per-channel reverb send (room+plate) exposed in `FxRoutingStats` for verification

**Output:** 60s PCM buffer (16-bit, 22050 Hz default, mono or stereo), WAV format, `audio.sha256`

**Determinism:** ✅ Same plan + same payload.hash → same PerformanceParams + InstrumentPalette + FX sends → same PCM → same audio.sha256.

---

### Stage 9: Provenance & Output

*Unchanged from previous audit.*

---

## 3. Audio Renderer Verification Scripts

| Script | Command | Verifies |
|--------|---------|----------|
| **Audio determinism** | `npm run test:audio-determinism` | WAV sha256 stability |
| **Instrumentation** | `npm run test:instrumentation-verification` | Determinism, peak/RMS bounds |
| **Mix balance** | `npm run test:mix-balance-verification` | bass_peak ≤ kick×1.4, kick_peak ≥ 0.08 |
| **FX routing** | `npm run test:fx-routing-verification` | bass send ≈ 0, reverb_return_lowband_rms < 0.008 |
| **Reverb send** | `npm run test:reverb-send-verification` | bass_reverb_send==0, kick_reverb_send==0, harmony_reverb_send>0 |
| **Harmony blend** | `npm run test:harmony-blend` | Harmony overlap, audio.sha256 stability |
| **Performance** | `npm run test:performance-verification` | Phrase envelope, harmony onset distribution |
| **Provenance** | `npm run test:provenance-verification` | Hash chain (snapshot → featurevec → v6 → plan) |
| **Mirror determinism** | `npm run test:mirror-determinism` | plan_sha256 stability |

**Status:** ✅ All tests passing

---

## 4. Redundancies & Duplicates

*Unchanged from previous audit. See section 3 of original.*

**Summary:** `lib/features/feature-encoder.js` is **confirmed unused** and safe to remove.

---

## 5. File Inventory (Music Production Pipeline)

### Core Pipeline Files

| File | Role | Determinism Impact |
|------|------|-------------------|
| **vnext/api/compose.ts** | Orchestration, payload generation, response assembly | ✅ Critical (payload.hash = seed) |
| **server/index.js** | Chart snapshot generation (Swiss Ephemeris) | ✅ Deterministic from inputs |
| **vnext/feature-encode.ts** | Snapshot → FeatureVec[64] | ✅ Pure function |
| **vnext/ml/index.ts** | FeatureVec → v6[6] (ML inference) | ✅ Deterministic (same model + input) |
| **vnext/astro/guidance.ts** | FeatureVec + Snapshot → AstroGuidance | ✅ Pure function |
| **vnext/astro/personality-profile.ts** | PersonalityProfileV1 computation | ✅ Pure function |
| **vnext/plan-generator.ts** | v6 + payload → Plan (K candidates, selection) | ✅ Seeded RNG |
| **vnext/planner/narrative.ts** | v6 + guidance → Plan.events | ✅ Fully deterministic |
| **vnext/audition-gate.ts** | Plan validation, timewarp/trim | ✅ Deterministic (may mutate plan) |
| **vnext/plan-hash.ts** | Plan canonicalization and hash | ✅ Defines identity |
| **vnext/audio/wav-renderer.ts** | Plan + seed → 60s WAV buffer | ✅ Seeded PRNG, ~1240 lines |
| **vnext/midi/plan-to-midi.ts** | Plan → MIDI base64 | ✅ Deterministic |

### Audio Renderer Changelogs (Reference)

| Changelog | Content |
|-----------|---------|
| **RENDERER-INSTRUMENTATION-V1-CHANGELOG.md** | Instrument palette, procedural synthesis |
| **MIX-BALANCE-V1-CHANGELOG.md** | Bass gain, sidechain, mix bus glue |
| **FX-ROUTING-V1-CHANGELOG.md** | Send/return buses, bass dry |
| **BASS-SUB-MID-V1-CHANGELOG.md** | Two-layer bass (sub + mid) |
| **INSTRUMENTATION-V2-CHANGELOG.md** | polyBLEP, reverb HPF/LPF, pre-delay |

---

## 6. Determinism Verification

### Determinism Contract

**Same inputs → same outputs:**
1. **Request** (date, time, lat, lon, mode) → same `EphemerisSnapshot`
2. **Snapshot** → same `FeatureVec[64]`
3. **FeatureVec** → same `v6[6]` (ML)
4. **FeatureVec + Snapshot + payload.hash** → same `AstroGuidance` + `PersonalityProfileV1`
5. **v6 + Guidance + payload.hash** → same `Plan.events`
6. **Plan + payload.hash** → same `audio.sha256`

**No randomness sources:**
- ✅ No `Math.random()` in plan or WAV paths
- ✅ No `Date.now()` in plan or WAV paths (except logging/IDs)
- ✅ All variation from seeded PRNG (`payload.hash` + stable keys)

---

## 7. Recent Additions (Post-Sonic Mirror)

### Personality Profile v1, Performance Layer v2, Provenance, Genre
*Unchanged from previous audit. See section 6 of original.*

### Audio Renderer Upgrades (2026-02)

| Upgrade | Summary |
|---------|---------|
| **Instrumentation v1** | Genre-keyed palette, procedural kick/hat/clap/bass/harmony/melody, mix glue |
| **Mix Balance v1** | Bass dominance fix, sidechain duck, master bus compression |
| **FX Routing v1** | ROOM/PLATE/DELAY sends, bass dry, reverb filtering |
| **Bass Sub+Mid v1** | Two-layer bass (sub sine + mid saw/square), HPF 35–40 Hz |
| **Instrumentation v2** | polyBLEP band-limited saw/square, reverb HPF 180–260 Hz, LPF 7–10 kHz, pre-delay 15–30 ms |

All additive; no API/contract/plan changes; determinism preserved.

---

## 8. Environment Variables Affecting Output

| Variable | Default | Effect | Determinism Impact |
|----------|---------|--------|-------------------|
| `VNEXT_HUMANIZE` | `1` (on) | Performance Layer v2 humanization | ✅ Same env → same WAV |
| `VNEXT_INSTRUMENTATION` | `1` (on) | Instrumentation layers (palette, FX, etc.) | ✅ Same env → same WAV |
| `VNEXT_INSTRUMENTATION_DEBUG` | `0` (off) | Per-stem peak/RMS, reverb send totals to console | Logging only |
| `VNEXT_K` | `8` | Number of plan candidates | ✅ Same env → same candidate set |
| `VNEXT_JITTER` | `0.10` | Jitter sigma for candidates | ✅ Same env → same jitter |
| `MIN_RULE_QUALITY` | From config | Quality threshold (reject if below) | Accept/reject only |
| `ENABLE_WAV_EXPORT` | `0` (off) | Include WAV in response | Does not change WAV content |
| `RUNTIME_MODEL` | `student-v2.8-slice-batch` | ML model version | ✅ Same model → same v6 |

---

## 9. Pipeline Health Metrics

| Metric | Status | Notes |
|--------|--------|-------|
| **Determinism** | ✅ Verified | All tests passing; no randomness in plan/WAV paths |
| **Test coverage** | ✅ Comprehensive | 9 music/audio verification scripts |
| **Code duplication** | ⚠️ Low | 1 redundancy (legacy encoder); test helpers acceptable |
| **Documentation** | ⚠️ Fragmented | Multiple overlapping audit docs; consolidation recommended |
| **Breaking changes** | ✅ None | All recent additions additive |
| **Performance** | ✅ Good | 60s WAV generation ~200–400 ms |
| **Maintainability** | ✅ Good | Clear separation; layered renderer stack |
| **Audio quality** | ✅ Improved | Band-limited synthesis, dry bass, controlled reverb |

---

## 10. Data Flow Summary

**Simplified chain:**
```
Request → Snapshot → FeatureVec → v6 (ML) + Guidance + Personality → Plan (narrative + gates) → WAV (renderer, seed = payload.hash)
```

**Audio renderer sub-chain:**
```
Plan + payload.hash
  → Performance params (ADSR, swing, jitter, pan)
  → Instrument palette (kick/hat/clap/bass/harmony/melody)
  → FX send amounts (room/plate/delay per channel)
  → Per-event synthesis (sine, polyBLEP saw/square, noise)
  → Mix (sidechain duck, master bus, EQ)
  → FX returns (HPF/LPF, pre-delay, reverb)
  → 60s PCM → audio.sha256
```

**All stages deterministic:** Same inputs → same outputs.

---

## 11. Recommendations

### 🔴 HIGH PRIORITY: Remove Legacy Feature Encoder
**Status:** ✅ **VERIFIED UNUSED**  
**Action:** Delete `lib/features/feature-encoder.js`

### 🟡 MEDIUM PRIORITY: Consolidate Test Helpers
**Action:** Consider extracting shared test utilities from `vnext/scripts/*`.

### 🟢 LOW PRIORITY: Documentation Consolidation
**Action:** Merge overlapping audit documents; use this document as canonical reference.

---

## 12. Conclusion

The music production pipeline is **well-architected**, **deterministic**, and **maintainable**. The audio renderer has evolved through six additive upgrades (Instrumentation v1, Mix Balance v1, FX Routing v1, Bass Sub+Mid v1, Instrumentation v2) without breaking changes. Band-limited synthesis (polyBLEP), dry bass, and controlled reverb improve tone and mix clarity.

**One redundancy identified:** Legacy `lib/features/feature-encoder.js` is **confirmed unused** and safe to remove.

**Pipeline status:** ✅ **Production-ready**

---

*Audit updated: 2026-02-11*  
*Previous audit: 2026-02-08*  
*Next review: After next major feature addition*
