# Browser Performance Engine Upgrade (Sample-First Instrumentation)

**Date:** 2026-02-12  
**Status:** ✅ Complete

## Summary

Upgraded Browser Performance Engine from "buzzy toy synth" to sample-first instrumentation with improved voicing. House genre now sounds like a coherent house sketch (drums + bass + chord stab + pluck/lead). All changes are additive; no API/contract changes.

## What Was Reused (No Duplication)

- **Genre enums:** Existing UI genre list (`GenerateCard`, composer) — `ambient`, `classical`, `jazz`, `lofi`, `house`, `electronic`. No new enum created.
- **payload.genre:** Backend `ControlSurfacePayload.genre` (default `"house"`) — reused.
- **Genre pack contract:** Extended existing `apps/web/src/core/genre/` instead of creating parallel systems.
- **Drum samples:** Reused existing `/audio/samples/drums/808/` (kick, snare, hat).
- **MIDI export:** Existing `vnext/midi/plan-to-midi.ts` — documented for future offline render.

## Changes Made

### 1. Extended Genre Pack Types (`apps/web/src/core/genre/types.ts`)

- Added `InstrumentSamples` interface (optional bass/harmony/melody sample URLs)
- Extended `SynthPatches` with `highpassHz` and `saturation` for improved voicing
- `GenrePack` now includes optional `instrumentSamples` (sample-first, synth fallback)

### 2. Upgraded House Pack (`apps/web/src/core/genre/house.ts`)

**Bass voicing (darker, non-tinny):**
- Lower LPF: 400-950Hz (was 600-1400Hz)
- HPF: 35-45Hz (removes sub-bass rumble)
- Subtle saturation: 0.02-0.05
- Longer decay: 0.20-0.42s

**Harmony voicing (warmer stab):**
- Lower LPF: 350-1200Hz (was 400-1400Hz)
- Slightly longer decay for stab character: 0.10-0.28s

**Melody voicing (clearer pluck):**
- Moderate LPF: 1000-2800Hz (was 1200-3600Hz)
- HPF: 200-300Hz (removes low-end fizz)
- Controlled pluck decay: 60-150ms

**FX discipline:**
- Reduced reverb: plate 0.06-0.12 (was 0.08-0.16)
- Reduced delay: 0.02-0.06 (was 0.03-0.08)
- Shorter delay time: 240-300ms (was 250-330ms)

### 3. Upgraded Browser Engine (`apps/web/src/core/audio/browser-performance-engine.ts`)

**Sample-first instrumentation:**
- Tries to load bass/harmony/melody samples if provided in pack
- Falls back to improved synth patches if samples unavailable
- Drums: always tries 808 samples, falls back to synth if missing

**Improved voicing:**
- **Bass:** HPF (35-45Hz) + LPF (400-950Hz) + saturation → mono → direct (no reverb)
- **Harmony:** LPF (350-1200Hz) → plate reverb + delay
- **Melody:** HPF (200-300Hz) + LPF (1000-2800Hz) → plate reverb + delay

**Verification logging:**
- `debug` option logs: samples loaded, synth fallbacks, reverb sends, sidechain kicks
- Enabled in development mode (`NODE_ENV === 'development'`)

**Clean node disposal:**
- All filters, synths, players, gains, FX disposed on `stop()`

### 4. Updated Architecture Doc (`docs/PERFORMANCE-ENGINES-ARCHITECTURE.md`)

- Clarified Layer A (Compose), Layer B (Browser Engine), Layer C (Server Render)
- Documented future export plan: MIDI → offline render using same Genre Pack
- Added verification/debug section

## Determinism Preserved

- Same `plan` + `seed` + `genre` → same scheduled event times
- Same seed → same parameter choices (filter cutoff, decay, gain, FX wet, saturation)
- No `Math.random`; all variations from `payload.hash` + stable keys

## Testing / Verification

**Build:** ✅ Next.js build passes (TypeScript type-checking)

**Debug output (dev mode):**
```javascript
[BrowserEngine] Stats: {
  samplesLoaded: { drums: true, bass: false, harmony: false, melody: false },
  synthFallbacks: { bass: true, harmony: true, melody: true },
  reverbWet: 0.08,
  delayWet: 0.04,
  sidechainKicks: 16
}
```

## Future Work

1. **Add instrument samples:** When bass/harmony/melody samples are available, update `instrumentSamples` in House pack
2. **ServerOfflineRenderEngine:** Implement MIDI → WAV render using same Genre Pack (SoundFont or curated samples)
3. **Additional genres:** Extend pack system for ambient, jazz, etc. (currently alias to house)

## Files Changed

- `apps/web/src/core/genre/types.ts` — Extended with `InstrumentSamples`, improved `SynthPatches`
- `apps/web/src/core/genre/house.ts` — Upgraded voicing parameters, added `instrumentSamples` structure
- `apps/web/src/core/genre/index.ts` — Export `InstrumentSamples` type
- `apps/web/src/core/audio/browser-performance-engine.ts` — Complete rewrite: sample-first, improved voicing, verification logging
- `apps/web/app/page.tsx` — Enable debug logging in dev mode
- `docs/PERFORMANCE-ENGINES-ARCHITECTURE.md` — Updated with Layer A/B/C and export plan
