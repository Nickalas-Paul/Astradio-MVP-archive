# Performance Engines Architecture

Layered server/browser approach and export plan. Plan is the single source of truth; no recomposition in playback. All variability is seeded from payload.hash (deterministic).

## Engine selection (web app)

- **Query param:** `?engine=browser|server|legacy` (default: `browser`) is a **preference**, not a hard lock.
- **Resolution:** Try requested engine first; on failure fall back in canonical order **browser → server WAV → legacy**. Same fallback order regardless of preference.
- **Hard lock (future):** A separate param e.g. `?engineLock=1` may be used to disable fallback; do not change behavior without documenting it.
- **Debug:** `?debug=1` shows engine chosen, voice mode per stem (sample | soundfont | synth), samples loaded, soundfont programs loaded, reverb send per stem.

## Layer A (existing): Composition Pipeline (server)

- **Request** → snapshot → features → ML → guidance → **plan** → provenance
- No changes. Swiss Ephemeris snapshot, feature encoding, ML, guidance, plan generation, Plan/EventToken schema, API request/response shapes, payload hashing, and provenance hashes are unchanged.
- **Determinism:** Same inputs → same plan.
- **Output:** `plan` (events with t0/t1/pitch/velocity/channel), `payload.hash` (seed), `payload.controls.genre` (default "house"), provenance hashes.

### Future: Plan Novelty Strategy (Library + Transformation)

Planner changes (libraries, transformations, novelty budget) are out of scope for this playback/engine stage. See `vnext/planner/` and future docs for Plan Novelty Strategy.

## Layer B: Browser Performance Engine (primary for "play")

- **Input:** `plan`, `seed` (payload.hash), `genre` from runtime (e.g. `payload.controls.genre` ?? 'house'). Use `payload.controls.genre` as the canonical genre field; do not introduce a second source.
- **Voice priority:** Sample first → SoundFont (if `NEXT_PUBLIC_SOUNDFONT=1`) → synth fallback
- **Stem chain per voice:** source (Sampler / SoundFont / Synth) → HPF + LPF (separate nodes, no filter inside Synth opts) → subtle saturation (WaveShaper) → optional chorus (harmony only) → stem gain → reverb/delay per pack; bass is mono, dry, never reverb/chorus
- **Bass:** MonoSynth (saw) when no sample; HPF ~30–40 Hz, LPF 200–800 Hz from pack; fast attack, short decay; no reverb
- **Harmony:** LPF 600–1200 Hz, HPF to remove mud; subtle chorus; plate + delay
- **Melody:** Triangle/sine when synth; HPF + LPF; plate + delay
- **Drums:** Sample-first (kick, clap, hat); closed hat uses shorter fade when same sample as open
- **Master routing:** All stems route to a shared master bus. Reverb and delay returns also route to master bus. Sidechain duck is applied on bass and harmony stem gain, triggered by kick onsets from Plan. Final limiter at -1 dB on master.
- **Determinism:** Same plan + seed + genre → same scheduling and parameter choices (no Math.random / Date.now). GenrePack provides base mix and FX values; seeded variation applies only as bounded deltas around the base (no wide parameter swings by seed).
- **Output:** Handle `start()` / `stop()` / `getStats()`; stats include voiceMode (sample | soundfont | synth), samplesLoaded, soundfontLoaded, reverbSends (actual send per stem)

## Layer C: Server Render Engines

| Engine | Role | Output |
|--------|------|--------|
| **ServerRenderEngine** (existing) | Fallback. Procedural synthesis in Node (`vnext/audio/wav-renderer.ts`). | WAV buffer (base64 or URL). |
| **ServerOfflineRenderEngine** (scaffold) | Export path when `VNEXT_OFFLINE_SF2=1`. MIDI → FluidSynth (SF2) or sample packs; same Genre Pack. See `docs/SERVER-OFFLINE-RENDER-ENGINE.md`. | WAV (authoritative for export). |

## Genre Packs

- **Location:** `apps/web/src/core/genre/` (shared contract and House pack).
- **Contract:** `GenreId`, `GenrePack` (drumKit, instrumentSamples?, soundfontPrograms?, synthPatches, fxProfile, mixProfile), `getGenrePack(genre, seed)`.
- **Instrument Source Strategy (Sample-First → SoundFont → Synth Fallback):**
  1. **Samples:** `instrumentSamples` (optional bass/harmony/melody URLs) tried first
  2. **SoundFont:** `soundfontPrograms` (MIDI program numbers) used if samples unavailable (browser: `apps/web/src/core/audio/soundfont-loader.ts`, server: FluidSynth SF2)
  3. **Synth:** `synthPatches` used as final fallback (Tone.js synths in browser, procedural in server)
- **Seeding:** GenrePack base values plus bounded seeded deltas only (no wide swings). All param variation from `payload.hash` + key (no `Math.random`). Same chart → same pack params.
- **Reuse:** Future `ServerOfflineRenderEngine` will:
  1. Export MIDI from plan (`vnext/midi/plan-to-midi.ts` exists)
  2. Render MIDI through FluidSynth (SF2) or sample packs using same Genre Pack; scaffold: `vnext/audio/server-offline-render-engine.ts`
  3. Ensure export WAV matches browser playback character (same samples, same patches)

## Why browser playback is not export-authoritative

- Device and sample-rate differences; no guarantee of bit-identical output.
- Export and sharing use the server (existing WAV render or future ServerOfflineRenderEngine) for a single, authoritative WAV.

## Interfaces (inputs/outputs)

- **Browser engine input:** `{ plan: Plan, seed: string (payload.hash), genre?: string, debug?: boolean }`
- **Browser engine output:** Handle `start()` / `stop()` / `getStats()`. Stats: engine (from page), samplesLoaded, voiceMode (sample | soundfont | synth), soundfontLoaded, reverbSends.
- **Server WAV renderer input:** `plan`, `payload`, `hash`; output: `{ buffer, sha256, duration_ms, size_bytes }`.
- **Offline render (scaffold):** Input: Plan, genrePack, seed. Export MIDI → FluidSynth (SF2 from SOUNDFONT_PATH) → WAV + sha256. See `vnext/audio/server-offline-render-engine.ts` and `docs/SERVER-OFFLINE-RENDER-ENGINE.md`.

## Verification / Debug

**Browser engine logs** (when `debug=true`):
- Which samples loaded vs synth fallbacks used
- Reverb send totals by channel
- Sidechain kick count
- FX wet amounts

**Determinism verification:**
- Same plan + seed + genre → same scheduled event times and chosen parameters (filter cutoff, decay, gain, FX wet)
