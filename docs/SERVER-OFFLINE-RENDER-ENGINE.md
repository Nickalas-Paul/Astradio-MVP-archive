# Server Offline Render Engine

## Purpose

High-quality WAV export for sharing and download. Renders the same Plan through FluidSynth (SF2) or sample packs so export matches browser playback character.

## Env flags

| Variable | Meaning |
|----------|---------|
| `VNEXT_OFFLINE_SF2=1` | Enable offline SF2 render path (when implemented). |
| `SOUNDFONT_PATH` | Path to SF2 file (local dev or server path). |

## Design

1. **Input:** Plan + payload.hash + genre (same as browser).
2. **Genre Pack:** `getGenrePack(genre, seed)` from `apps/web/src/core/genre`. Same contract as browser.
3. **MIDI:** Export from Plan via `vnext/midi/plan-to-midi.ts` (planToMidiBase64).
4. **Instruments:** `mapGenrePackToFluidSynthPrograms(pack)` → bass/harmony/melody GM program numbers.
5. **Render:** FluidSynth (or equivalent) renders MIDI + SF2 → PCM.
6. **Output:** WAV buffer, duration, sampleRate, bitDepth, sha256 (cache key: plan_sha256 + payload hash).

## SF2 supply

- **Local dev:** Set `SOUNDFONT_PATH` to a local SF2 (e.g. FluidR3_GM.sf2). Do not commit large binaries.
- **Production:** Serve SF2 from CDN or asset store; document path in deployment config.
- **Licensing:** FluidR3_GM is free; verify attribution and license for any other SF2.

## Status

Scaffold and interfaces only. Actual FluidSynth integration (Node binding or subprocess) is TODO. Use existing WAV renderer as fallback until implemented.
