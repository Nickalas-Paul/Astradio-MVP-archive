# Genre Infrastructure Findings (Browser Performance Engine)

**Date:** 2026-02-12

## What Exists (Reused)

- **Genre UI / enums:** `GenerateCard.tsx` and composer/overlay/sandbox use a shared list: `ambient`, `classical`, `jazz`, `lofi`, `house`, `electronic`. Genre is passed as `CompositionRequest.genre` and used in UI only; no separate "genre pack" type.
- **Payload.genre:** Backend uses `payload.genre` (default `"house"`) in:
  - `vnext/audio/wav-renderer.ts`: `getInstrumentPalette(genre, seed)` and `getFXSendAmounts(genre, seed)` — genre-keyed, deterministic from seed.
  - `vnext/explainer/contracts.ts`: `ControlSurfacePayload.genre` optional, documented as `"house" | "classical" | "jazz" | "ambient" | "electronic"`.
- **Instrument palette (server only):** `vnext/audio/wav-renderer.ts` defines `InstrumentPalette` (kick, clap, hat, bass, harmony, melody params) and `getInstrumentPalette(genre, seed)`. House is fully implemented; other genres fall back to house. This is Node-only (procedural synthesis, no samples).
- **Plan/EventToken:** `vnext/contracts.ts` — `EventToken` has `t0`, `t1`, `pitch`, `velocity`, `channel: 'melody'|'harmony'|'rhythm'|'bass'`. Rhythm pitches: kick=36, clap=38, hat=42 (GM-style in wav-renderer).
- **plan-to-tone-events:** Two copies: `vnext/client/plan-to-tone-events.ts` (imports vnext contracts) and `apps/web/src/core/plan-to-tone-events.ts` (duplicated Plan/EventToken types). Web app uses the latter for Tone.js scheduling.

## What Is New (No Duplication of Genre Definitions)

- **Genre pack contract (shared contract):** New module `apps/web/src/core/genre/` defines `GenreId`, `GenrePack`, and `getGenrePack(genre, seed)` for **browser** use (Tone.js samples + synth params, FX profile, mix). This does not replace the server’s `getInstrumentPalette`; it is the browser-side counterpart. Same genre ids and default `"house"` as payload/UI.
- **Browser Performance Engine:** New module consumes Plan + `payload.hash` + `payload.genre ?? 'house'`, uses the new genre pack, and plays via Tone.js (samples for drums, synths for bass/harmony/melody, sidechain, reverb/delay). Server WAV renderer remains unchanged and is used as fallback when browser engine fails or for export.
- **Drum samples:** No existing assets folder for audio samples. New `public/audio/samples/house/` (or similar) for kick, clap, closed hat, open hat; paths and README for licensing. If samples are missing, engine can fall back to Tone synthesis (as wav-renderer does).

## Summary

| Concept            | Location / usage |
|--------------------|------------------|
| Genre enum (UI)    | GenerateCard, composer, overlay, sandbox — reused; no new enum. |
| payload.genre      | Backend compose response `controls.genre`; default `"house"` — reused. |
| Instrument palette | Server: `vnext/audio/wav-renderer.ts` — unchanged. |
| Genre pack (browser)| New: `apps/web/src/core/genre/` — House pack only; extensible for other genres. |
| Browser engine     | New: consumes Plan, hash, genre; uses genre pack; Tone.js. |
| Drum samples       | New: `public/audio/samples/` structure; placeholders or curated; licensing in README. |
