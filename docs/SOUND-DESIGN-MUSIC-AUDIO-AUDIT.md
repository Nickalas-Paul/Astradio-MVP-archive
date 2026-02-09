# Sound Design, Music Composition & Audio Output — Code Review & Audit

**Scope:** All code paths affecting sound design, music composition, and audio output after Sonic Mirror implementation.  
**Date:** 2026-02-08  
**Branch:** beta-ui-vercel (post Sonic Mirror commit)

---

## 1. Pipeline Overview

```
Request (mode, chartData, controls)
  → generateControlPayload() → payload.hash (deterministic from payload)
  → fetchChartSnapshot()     → EphemerisSnapshot
  → encodeFeatures(snapshot) → FeatureVec
  → generatePlanMLOnly(feat, payload)  ← uses payload as chartContext (hash = payload.hash)
        → studentVector(feat)         → v6 [ML]
        → guidanceFromFeatures(feat, snapshot) → AstroGuidance + elementBlend, motionProfile, narrativeArc
        → K candidates: planFromVector(v6_jittered, guidanceWithSeed)
        → ruleQualityPass(plan) + scoreMirrorFidelity(plan, guidance)
        → best by rankScore
  → audition(plan) / runAuditionGates(plan, payload.hash)
  → renderWav60s(plan, payload, payload.hash) → WAV buffer + sha256
  → (optional) planToMidiBase64(plan) → MIDI base64 + sha256
```

**Contracts:** `Plan` (id, featureHash, durationSec, bpm, key, events), `EventToken` (t0, t1, pitch, velocity, channel). No changes to these types; Sonic Mirror is additive in guidance and planner behavior.

---

## 2. Guidance Layer (vnext/astro/guidance.ts)

| Aspect | Status | Notes |
|--------|--------|--------|
| **Purity** | OK | No side effects, no `Math.random`/`Date.now`. All outputs from `featureVec` + `chartContext` only. |
| **Element blend** | OK | `normalizeElementBlend` ensures sum ≈ 1; indices 27–30 (fire, earth, air, water) from feature encoder. |
| **Motion profile** | OK | Fire→Air→Water→Earth weighting: motion, articulation, shimmer, gravity, flow in [0,1]. |
| **Narrative arc** | OK | Fixed 15 / 30 / 15 s; used by planner as bar-based phases (4 / 8 / 4 bars). |
| **Backward compat** | OK | Return type extends `AstroGuidance` with extra fields; existing callers still get tempo/arc/density/motif/cadence. |

**Risk:** None in plan or audio path. `applyGuidanceBias` is still used only with the original AstroGuidance fields elsewhere; narrative planner reads the new fields directly.

---

## 3. Narrative Planner (vnext/planner/narrative.ts)

| Aspect | Status | Notes |
|--------|--------|--------|
| **Determinism** | OK | No `Math.random` or `Date.now`. Same `(v6, guidance)` ⇒ same `Plan.events`. |
| **Phase model** | OK | Bar-based: Encounter bars 0–3, Recognition 4–11, Integration 12–15. Independent of BPM/duration. |
| **Harmonic field** | OK | `preferRootPosition(phase, gravity)` biases inversion choice in Encounter and Integration (gravity ≥ 0.4). Voice-leading cost + 20 for non-root when preferRoot. |
| **Melody duration** | OK | `effectiveDur` scaled by flow/articulation; cap 2.5 s (4 s in Integration when earth-dominant). Min 0.25 beats. |
| **Register** | OK | `registerBias = round((shimmer - 0.5)*2 - (gravity - 0.5)*1)`; phrase centers clamped 48–72. |
| **Min melody per phase** | OK | [8, 12, 8]; filler notes are chord-tone 0.25-beat, deterministic from `guidance.seed`. |
| **Filler overlap** | Low | Filler can coincide with existing melody; deterministic for same seed. No spec requirement to avoid overlap. |

**Risks:**  
- Plan `durationSec` can be &lt; 60 s at high BPM (e.g. 16 bars × 4 beats at 120 BPM ≈ 32 s). Phase boundaries in the planner are bar-based, so structure is preserved; only wall-clock length changes.  
- `phraseCenters` clamped to [48, 72] can compress spread when `arcLift` is large; acceptable.

---

## 4. Critics (vnext/critics/index.ts, mirror-fidelity.ts)

| Aspect | Status | Notes |
|--------|--------|--------|
| **ruleQualityPass** | Unchanged | Still uses melody/harmony/rhythm thresholds; no mirror score in gate. MIN_RULE_QUALITY still applies to `q.score` only. |
| **scoreMirrorFidelity** | OK | Time-based phases (0–15, 15–45, 45–60 s). When plan is &lt; 60 s, Integration window (45–60 s) may have no events → returns 0.5. |
| **Encounter stability** | OK | Fewer unique roots in first 15 s ⇒ higher score. |
| **Recognition motion** | OK | Count + pitch delta in 15–45 s. |
| **Integration coherence** | OK | Tonic pull from last melody note vs harmony root; `harmIn.slice(-4)` safe when `harmIn.length > 0`. |
| **Repetition penalty** | OK | Only penalizes long runs (≥ 4 same pitch); “inhabitable” repetition not over-penalized. |

**Recommendation:** If desired, mirror-fidelity could use bar-based phase (like the planner) when `plan.durationSec` is known, so Integration is “last 4 bars” instead of 45–60 s. Optional; current behavior is safe.

---

## 5. Plan Generator (vnext/plan-generator.ts)

| Aspect | Status | Notes |
|--------|--------|--------|
| **Seeded RNG** | OK | `createSeededRNG(seedStr)` from `payload.hash`; jitter deterministic. |
| **Mirror in ranking** | OK | `rankScore = q.score + 0.2 * mirrorScore`; gate still uses `best.q.score >= MIN_Q`. |
| **Guidance context** | Caution | When building snapshot from `chartContext`, `ts` is `chartContext.ts || chartContext.date || new Date().toISOString()`. If caller omits `ts` and `date`, guidance becomes non-deterministic across runs. Compose API uses `fetchChartSnapshot`, which should supply `ts`; risk is low in production. |

**Recommendation:** For strict determinism, prefer `chartContext.ts ?? chartContext.date ?? ''` and treat missing as “no timestamp” (e.g. use a fixed default or omit guidance) rather than `new Date().toISOString()`.

---

## 6. Plan → MIDI (vnext/midi/plan-to-midi.ts)

| Aspect | Status | Notes |
|--------|--------|--------|
| **Determinism** | OK | Same plan ⇒ same MIDI bytes; PPQ=480, roundTime to 1 ms. |
| **Channels** | OK | melody, harmony, bass, rhythm; track order and naming stable. |
| **Velocity** | OK | Plan [0,1] → MIDI 1–127 → normalized for @tonejs/midi. |

No changes from Sonic Mirror; plan events are passed through as-is.

---

## 7. Plan + Hash → WAV (vnext/audio/wav-renderer.ts)

| Aspect | Status | Notes |
|--------|--------|--------|
| **Determinism** | OK | All variation from `seed` (payload.hash): `hashU32`, `rand01`, `randSigned`. No `Math.random`. Same plan + same hash ⇒ same buffer ⇒ same sha256. |
| **Humanization** | OK | Timing jitter, swing, velocity curve, ADSR, pan, legato overlap, phrase gap, reverb taps — all keyed by seed + stable keys. |
| **Duration** | OK | Fixed 60 s buffer; events outside 60 s are clipped by sample index. |
| **Fallback** | OK | On exception, buildWav('fallback', null, …) produces a deterministic tone; no leak of non-determinism. |

Sonic Mirror does not change the renderer; planner outputs (shorter notes, more motion, phase-based harmony) flow through existing pipeline.

---

## 8. Compose API & Audition (vnext/api/compose.ts, audition-gate.ts)

| Aspect | Status | Notes |
|--------|--------|--------|
| **Plan usage** | OK | Plan from `generatePlanMLOnly(featureVec, payload)`; payload has hash; no change to request/response shape or hashing. |
| **Audio seed** | OK | `renderWav60s(plan, payload, payload.hash)`; plan_sha256 and audio.sha256 remain deterministic for same request/snapshot/payload. |
| **Audition** | OK | `audition(plan)` still uses `ruleQualityPass(plan)` only; mirror fidelity is not required for gate pass. |

---

## 9. Determinism Summary

| Contract | Guarantee |
|----------|------------|
| Same request (mode, chartData, controls) + same snapshot | Same payload.hash, same featureVec, same guidance. |
| Same payload.hash (seed) + same ML vector | Same jittered candidates, same ranking, same chosen plan. |
| Same plan | Same plan_sha256 (canonicalizePlan + SHA256). |
| Same plan + same payload.hash | Same WAV buffer, same audio.sha256. |

**Non-determinism only in:**  
- `plan-generator.ts`: fallback `new Date().toISOString()` when chartContext has no ts/date (recommend removing for strictness).  
- Scripts/tests that use `Date.now()` / `Math.random()` for timing or test data only (not in plan or wav path).

---

## 10. Sound Design & Composition Behavior (Post–Sonic Mirror)

- **Harmony:** Carries identity; Encounter and Integration (with high gravity) prefer root-position triads; voice-leading still minimizes movement. Natural minor, chord tones on long notes and phrase ends.
- **Melody:** Motion within harmony; stepwise bias; chord-tone resolution on sustained notes; max sustain 2.5 s (4 s in Integration when earth-dominant); min events per phase 8/12/8; register shaped by shimmer/gravity.
- **Tempo/density:** From v6 + tempo/density bias; BPM 70–140; density affects ornament and rhythm omissions.
- **Audio output:** Plan events rendered with deterministic humanization (jitter, swing, velocity, ADSR, pan, reverb) keyed by payload.hash; 60 s 16-bit PCM WAV; optional MIDI export 1:1 with plan.

---

## 11. Recommendations

1. **Strict determinism:** In `plan-generator.ts`, avoid `new Date().toISOString()` when building snapshot from chartContext; use a fixed default or omit ts so guidance is deterministic.
2. **Optional:** Mirror-fidelity critic could use bar-based phases when `plan.durationSec` and `plan.bpm` are set, so Integration is “last 4 bars” for plans shorter than 60 s.
3. **No change required:** API routes, request/response shapes, payload hashing, caching keys, contract types, and wav-renderer are unchanged and compliant with the Sonic Mirror constraints.

---

## 12. Files Touched (Sonic Mirror) — Quick Reference

| File | Role in sound/composition/audio |
|------|----------------------------------|
| `vnext/astro/guidance.ts` | Element blend, motion profile, narrative arc → planner and mirror critic. |
| `vnext/planner/narrative.ts` | Harmonic field, melody sustain/flow/articulation, phase minima, register. |
| `vnext/critics/mirror-fidelity.ts` | Mirror fidelity score for candidate ranking. |
| `vnext/critics/index.ts` | Re-export mirror fidelity. |
| `vnext/plan-generator.ts` | Ranking includes mirror score; guidance passed to planner. |
| `vnext/scripts/mirror-report.ts` | Report only; no runtime effect. |
| `vnext/scripts/mirror-determinism.ts` | Tests only; no runtime effect. |

No changes: `contracts.ts`, `plan-hash.ts`, `feature-encode.ts`, `midi/plan-to-midi.ts`, `audio/wav-renderer.ts`, `api/compose.ts` (hashing and request shape), `audition-gate.ts` (gate logic).
