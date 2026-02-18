# Audio Renderer Notes

## What changed

The server-side WAV path was upgraded from a **stub** (that threw when `ENABLE_WAV_EXPORT=1`) to a **deterministic synth renderer** in `vnext/audio/wav-renderer.ts`. No changes were made to plan generation, audition gates, or ML runtime.

- **Oscillators:** Layered sine + triangle + optional saw (mix per preset). Phase accumulation only; no randomness.
- **Envelope:** ADSR per note (attack, decay, sustain, release in seconds). Fixed coefficients per preset.
- **Filter:** One-pole lowpass per note; cutoff = `cutoffBaseHz + velocity * cutoffVelScaleHz`. Q fixed per preset.
- **Saturation:** Soft clip (symmetric, deterministic) after filter; optional drive per preset.
- **Reverb:** Simple fixed-coefficient comb (two delays, fixed decay). Enabled per preset; mix and decay fixed.
- **Per-channel:** Gain and pan per channel role. Bass: lower cutoff (×0.55) and shorter release (×0.7). Melody: brighter cutoff (×1.1) and faster attack (×0.8). Harmony: slower attack (×1.4) and lower cutoff (×0.85). Rhythm: faster attack (×0.5) for transient emphasis. All deterministic.
- **Master:** Peak detection, scale-down if above 0.95, then final soft clip. No clipping; output stays within bounds.

Audio no longer sounds like pure sine beeps; it reads as more instrument-like while keeping the same plan (notes, timing, structure).

## Preset mapping

Preset selection is **deterministic** and uses only:

- `controls.element_dominance` → one of `fire`, `earth`, `air`, `water` → selects preset **id** (fire/earth/air/water).
- `controls.aspect_tension` (0–1) → biases **filter cutoff** and **drive** (higher tension → slightly brighter and more drive). No randomness; formula is fixed.

| Element | Preset id | Character (short) |
|--------|------------|-------------------|
| fire   | fire       | Brighter filter, faster attack, more saw, more drive |
| earth  | earth      | Rounder (sine+tri), slower envelope, less drive |
| air    | air        | Bright, fast attack, light reverb |
| water  | water      | Softer filter, longer release, more reverb |

Default when `element_dominance` is missing or invalid: **air**.

Per-channel gain/pan are fixed per preset (e.g. melody louder, harmony lower and panned, bass center, rhythm slight pan).

## Wiring

- **Compose:** When `ENABLE_WAV_EXPORT=1`, compose calls `renderWav60s(plan, payload, payload.hash, { sampleRate: 22050, channels: 1, bitDepth: 16, debugAudio })`. No other server path generates WAV from the plan; the legacy `generateAudioBuffer` in `server/index.js` is a separate flow (different composition format) and was not changed.
- **Debug artifact:** If the request body includes `debug_audio: true`, the compose response includes `audio_debug` with: `presetId`, `env`, `filter`, `drive`, `reverb`, `perChannelGains`, `perChannelPan`, `masterPeak`. Default response shape is unchanged when `debug_audio` is not set.

## Determinism

- No `Math.random`, no `Date.now()`, no time-based modulation in the renderer.
- Same `plan` + same `payload` (same `element_dominance` and `aspect_tension`) + same options → same WAV bytes and same `sha256`.

## How to run the audio tests

Build output lives under `dist/vnext/vnext/` (vnext tsconfig rootDir at repo root). After `npm run vnext:build`:

1. **Determinism**  
   `npm run test:audio-determinism`  
   Runs build then `node dist/vnext/vnext/scripts/audio-renderer-determinism.js`. Asserts same sha256 and length across two renders, peak in bounds, first 1024 PCM bytes identical.

2. **Compose contract**  
   `npm run test:audio-contract`  
   Runs build then `node dist/vnext/vnext/scripts/compose-audio-contract-test.js`. Calls compose in-process with mocked chart-snapshot. Asserts: no `audio_debug` without `debug_audio`; with `debug_audio=true`, `audio_debug` has presetId, env, filter, drive, reverb, perChannelGains, perChannelPan, masterPeak; `audio.sha256` stable across identical calls. **ML skip:** If ML is unavailable, the test **fails** (exit 1) unless `ALLOW_ML_SKIP=1` is set; in CI, omit it so missing ML fails the run.

3. **Audio sanity**  
   `npm run test:audio-sanity`  
   Runs build then `node dist/vnext/vnext/scripts/audio-sanity.js`. Renders fixed 2-note plan (mono and stereo), decodes WAV, asserts peak ≤ 1, |mean| < 1e-3, length within tolerance, channel count correct. Then renders a deterministic **busy plan** (many overlapping notes across melody, harmony, bass, rhythm) and asserts peak ≤ 1, masterPeak in [0.15, 0.98] (meaningful level, no clipping), |mean| < 1e-3 for mono and stereo.

4. **Compose soak**  
   `npm run test:compose-soak`  
   Runs build then `node dist/vnext/vnext/scripts/compose-determinism-soak.js`. Runs compose N times (default 20, set `COMPOSE_SOAK_RUNS`) with a fully fixed request (date/time/lat/lon explicit), 250 ms delay between runs. Asserts audio.sha256 identical, gate_report.calibrated.overall true, response has audio.format/base64/sha256. Outputs count, sha256, min/avg/max latency_ms, passes. If ML unavailable, fails unless `ALLOW_ML_SKIP=1`.

5. **All audio tests**  
   `npm run test:audio`  
   Runs build once then determinism, contract, and sanity (including busy plan) in sequence.

6. **Live HTTP soak (Render / any base URL)**  
   `ASTRADIO_BASE_URL=https://your-app.onrender.com npm run test:compose-live-soak`  
   **Required env:** `ASTRADIO_BASE_URL` (no default; script exits 1 if unset). Optional: `LIVE_SOAK_RUNS` (default 20), `LIVE_SOAK_DELAY_MS` (default 750), `LIVE_DEBUG_AUDIO` (default 0). POSTs a fixed deterministic request (explicit date/time/lat/lon) to `${ASTRADIO_BASE_URL}/api/compose` N times with delay. Asserts: HTTP 200, `audio.sha256` present, `gate_report.calibrated.overall` true, all sha256 identical. Fails fast on non-200, missing sha, gate fail, or sha mismatch. Prints compact summary (count, sha256 prefix, min/avg/max latency_ms). No mocks; uses fetch only.

## Files touched (minimal PR)

- `lib/hash/chartHash.ts` – build fix: inlined `stableStringify` and use Node `crypto` so this file does not depend on `apps/web/src/core/hash`.
- `vnext/audio/wav-renderer.ts` – full implementation (presets, oscillators, ADSR, filter, reverb, master).
- `vnext/api/compose.ts` – pass `debugAudio` into `renderWav60s`; add `audio_debug` to response when requested.
- `vnext/scripts/audio-renderer-determinism.ts` – determinism test script.
- `vnext/scripts/compose-audio-contract-test.ts` – compose response shape and debug_audio contract test; ML skip only when `ALLOW_ML_SKIP=1`.
- `vnext/scripts/compose-determinism-soak.ts` – in-process soak (N runs, mocked fetch).
- `vnext/scripts/compose-live-soak.ts` – live HTTP soak (N runs, no mocks; requires ASTRADIO_BASE_URL).
- `vnext/scripts/audio-sanity.ts` – peak, DC, length, channel-count sanity test; includes busy-plan masterPeak check.
- `package.json` – scripts `test:audio-determinism`, `test:audio-contract`, `test:audio-sanity`, `test:audio`, `test:compose-soak`, `test:compose-live-soak`.
- `docs/AUDIO-RENDERER-NOTES.md` – this file.

No changes to `vnext/plan-generator.ts`, `vnext/planner/narrative.ts`, or `vnext/audition-gate.ts`.
