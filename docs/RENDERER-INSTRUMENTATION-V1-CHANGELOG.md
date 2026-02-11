# Renderer Instrumentation Layer v1 – Changelog

## Summary
Additive upgrade to the WAV renderer: genre-keyed instrument palette with procedural synthesis for house (kick, hat, clap, bass, harmony, melody), plus mix glue (pseudo-sidechain duck, per-channel EQ). Improves timbre and groove for the default genre "house" without changing Plan, EventToken, API, or determinism guarantees.

## Files touched
- **vnext/audio/wav-renderer.ts** – Instrument palette (`getInstrumentPalette`), channel-specific synthesis (kick: pitch-drop sine + click + saturation; hat: highpassed noise; clap: filtered noise + room reflection; bass: saw/square + LPF + saturation; harmony: stab + lowpass sweep + stereo widen; melody: pluck + vibrato). Mix glue: kick-onset sidechain duck on bass/harmony, highpass 50Hz + lowpass 14kHz on mix, headroom normalization. Genre from `payload.genre` (default "house").
- **vnext/scripts/instrumentation-verification.ts** (new) – Determinism + spectral sanity check for house-style plan with rhythm, bass, harmony, melody.
- **package.json** – Added `test:instrumentation-verification` script.

## Behavior changes
- **Audio:** Same plan + same payload.hash ⇒ same WAV sha256 (determinism preserved). Audio sounds fuller: kick has body, hats are crisp, bass is present, harmony stabs have shape.
- **Genre:** Read `payload.genre`; default "house". Palette params derived from `hashU32(seed, key)` – fully deterministic.
- **Env:** `VNEXT_INSTRUMENTATION=0` disables instrumentation; `VNEXT_INSTRUMENTATION_DEBUG=1` prints peak, RMS, kick count, avg duck to console.

## Determinism
- No `Math.random`, `Date.now`, or runtime-dependent values.
- All variation from `payload.hash` + stable keys (`palette:house:…`, `inst:…`, `n:…`).
- Same (plan, payload.hash) ⇒ identical PCM and audio.sha256.

## Commands
```bash
npm run vnext:build
npm run test:audio-determinism
npm run test:instrumentation-verification
VNEXT_INSTRUMENTATION_DEBUG=1 node dist/vnext/vnext/scripts/instrumentation-verification.js
```
