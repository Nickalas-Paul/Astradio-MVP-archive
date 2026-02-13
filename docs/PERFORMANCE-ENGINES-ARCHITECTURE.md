# Performance Engines Architecture

Layered server/browser approach and future export plan. Sample-first instrumentation with improved voicing.

## Layer A (existing): Composition Pipeline (server)

- **Request** → snapshot → features → ML → guidance → **plan** → provenance
- No changes. Swiss Ephemeris snapshot, feature encoding, ML, guidance, plan generation, Plan/EventToken schema, API request/response shapes, payload hashing, and provenance hashes are unchanged.
- **Determinism:** Same inputs → same plan.
- **Output:** `plan` (events with t0/t1/pitch/velocity/channel), `payload.hash` (seed), `payload.genre` (default "house"), provenance hashes.

### Plan Novelty Strategy (Library + Transformation)

**Problem:** Formulaic scale melodies over repeated chord loops.

**Solution:** Expanded libraries + deterministic transformations:

1. **Expanded Libraries** (`vnext/planner/libraries.ts`):
   - **30-60 chord progressions:** Diatonic loops, modal interchange, secondary dominants, pedal variations (4 or 8 bars)
   - **12 bassline patterns:** Offbeat, rolling, syncopated pickup, sustained, walking, pedal
   - **50 hook motifs:** Ascending, descending, arc, call-response, repetitive, ornamental families (1-2 bars)

2. **Deterministic Selection:**
   - Seeded from `payload.hash` + snapshot/features
   - Elements/modality/aspect_tension → brightness families
   - Moon phase → cadence style
   - Cluster density → rhythmic density of hook
   - Dominant planet → register and repetition

3. **Transformation Pipeline** (`vnext/planner/transformations.ts`):
   - **2-4 transformations per track:** transpose, rhythmic shift, invert, octave displace, truncate/extend, add pickup, add rest before cadence, ornament
   - **A/A'/B/A structure:** A (original), A' (one transformation), B (contrast), A (return with fill)
   - Seeded and feature-driven (Mercury agility → rhythmic/ornamental, Fire/Air → transpose/extend)

4. **Harmonic Rhythm & Voicing Variation:**
   - More chord rhythm patterns per phrase
   - Chord extensions (6/7/9) controlled by tension and personality gravity
   - Voice-leading with constraints (no mechanical jumps)

5. **Novelty Budget (Debug IDs):**
   - `plan.debug.progressionId`, `motifId`, `bassPatternId`, `transformationSequence`
   - Ensures each new plan differs measurably from previous
   - Verification script: `vnext/scripts/plan-novelty-verification.ts`

## Layer B: Browser Performance Engine (authoritative for "play" in beta)

- **Input:** `plan`, `seed` (payload.hash), `genre` (payload.genre ?? 'house')
- **Uses:** Tone.js + sample-first instrumentation (drums: 808 samples; bass/harmony/melody: samples if provided, synth fallback)
- **Genre Pack:** `apps/web/src/core/genre/` — House pack with improved voicing:
  - **Bass:** Darker LPF (400-950Hz), HPF (35-45Hz), subtle saturation, mono, no reverb
  - **Harmony:** Warmer stab (350-1200Hz LPF), plate reverb + delay
  - **Melody:** Clearer pluck (1000-2800Hz LPF), HPF (200-300Hz), plate reverb + delay
- **FX:** Sidechain ducking (bass/harmony from kick), plate reverb (harmony/melody only), tempo delay
- **Determinism:** Same plan + seed + genre → same scheduled events, same parameter choices (filter cutoff, decay, gain, FX wet)
- **Output:** Live playback handle (`start()` / `stop()`); not export-authoritative

## Layer C: Server Render Engines

| Engine | Role | Output |
|--------|------|--------|
| **ServerRenderEngine** (existing wav-renderer) | Fallback and legacy. Procedural synthesis in Node (`vnext/audio/wav-renderer.ts`). Keep as fallback; stop investing heavily in procedural synth quality. | WAV buffer (base64 or URL). |
| **ServerOfflineRenderEngine** (future) | High-quality WAV for share/export. **MIDI → offline render** using SoundFont or curated sample packs. Reuses same Genre Pack definitions (drum samples + synth patches) so export matches browser character. | Export WAV (authoritative). |

## Genre Packs

- **Location:** `apps/web/src/core/genre/` (shared contract and House pack).
- **Contract:** `GenreId`, `GenrePack` (drumKit, instrumentSamples?, soundfontPrograms?, synthPatches, fxProfile, mixProfile), `getGenrePack(genre, seed)`.
- **Instrument Source Strategy (Sample-First → SoundFont → Synth Fallback):**
  1. **Samples:** `instrumentSamples` (optional bass/harmony/melody URLs) tried first
  2. **SoundFont:** `soundfontPrograms` (MIDI program numbers) used if samples unavailable (browser: `apps/web/src/core/audio/soundfont-loader.ts`, server: FluidSynth SF2)
  3. **Synth:** `synthPatches` used as final fallback (Tone.js synths in browser, procedural in server)
- **Seeding:** All param variations (filter cutoff, decay, gain, FX wet, saturation, HPF/LPF) are derived from `payload.hash` + key (no `Math.random`). Same chart → same pack params.
- **Reuse:** Future `ServerOfflineRenderEngine` will:
  1. Export MIDI from plan (`vnext/midi/plan-to-midi.ts` already exists)
  2. Render MIDI through SoundFont or curated sample packs using the same Genre Pack definitions
  3. Ensure export WAV matches browser playback character (same samples, same patches)

## Why browser playback is not export-authoritative

- Device and sample-rate differences; no guarantee of bit-identical output.
- Export and sharing use the server (existing WAV render or future ServerOfflineRenderEngine) for a single, authoritative WAV.

## Interfaces (inputs/outputs)

- **Browser engine input:** `{ plan: Plan, seed: string (payload.hash), genre?: string, debug?: boolean }`
- **Browser engine output:** Handle with `start()` / `stop()`; verification stats (samples loaded, synth fallbacks, reverb sends) when `debug=true`.
- **Server WAV renderer input:** `plan`, `payload`, `hash`; output: `{ buffer, sha256, duration_ms, size_bytes }`.
- **Future offline render:** 
  - **Step 1:** Export MIDI from plan (`planToMidiBase64(plan)` → MIDI bytes)
  - **Step 2:** Render MIDI through SoundFont/sample packs using Genre Pack (same samples/patches as browser)
  - **Output:** WAV file for download/share (authoritative, matches browser character)

## Verification / Debug

**Browser engine logs** (when `debug=true`):
- Which samples loaded vs synth fallbacks used
- Reverb send totals by channel
- Sidechain kick count
- FX wet amounts

**Plan novelty verification** (`vnext/scripts/plan-novelty-verification.ts`):
- Prints `progressionId`, `motifId`, `bassPatternId`, `transformationSequence`
- Confirms determinism: same seed + inputs → same IDs
- Confirms novelty: different seed → different IDs

**Determinism verification:**
- Same plan + seed → same scheduled event times, same chosen parameters (filter cutoff, decay, gain, FX wet)
- Same seed + inputs → same progression/motif/bass pattern IDs and transformation sequence
