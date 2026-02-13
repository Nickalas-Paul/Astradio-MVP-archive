# Performance Engines Architecture

Short doc: layered server/browser approach and future export plan.

## Layer A (existing): Composition Pipeline (server)

- **Request** → snapshot → features → ML → guidance → **plan** → provenance
- No changes. Swiss Ephemeris snapshot, feature encoding, ML, guidance, plan generation, Plan/EventToken schema, API request/response shapes, payload hashing, and provenance hashes are unchanged.
- **Determinism:** Same inputs → same plan.

## Layer B: Performance Engines

Performance engines consume the **Plan** and **payload** (hash, genre) to produce audio. Plan is the single source of truth for notes and timing.

| Engine | Role | Output |
|--------|------|--------|
| **BrowserPerformanceEngine** (Tone.js) | Default playback in the browser. Uses Genre Packs (samples + synths), sidechain, reverb/delay. | Live playback only; not export-authoritative. |
| **ServerRenderEngine** (existing wav-renderer) | Fallback and legacy. Renders 60s WAV from plan + payload in Node. | WAV buffer (base64 or URL). |
| **ServerOfflineRenderEngine** (future) | High-quality WAV for share/export. Will use the **same** Genre Pack definitions (drum samples + synth patches) so export matches browser character. | Export WAV (authoritative). |

## Genre Packs

- **Location:** `apps/web/src/core/genre/` (shared contract and House pack).
- **Contract:** `GenreId`, `GenrePack` (drumKit, synthPatches, fxProfile, mixProfile), `getGenrePack(genre, seed)`.
- **Seeding:** All param variations (filter cutoff, decay, gain, FX wet, etc.) are derived from `payload.hash` + key (no `Math.random`). Same chart → same pack params.
- **Reuse:** Future server offline render will import the same types and pack logic (or a server-safe mirror) so drum samples and synth patches are shared between browser playback and export.

## Why browser playback is not export-authoritative

- Device and sample-rate differences; no guarantee of bit-identical output.
- Export and sharing use the server (existing WAV render or future ServerOfflineRenderEngine) for a single, authoritative WAV.

## Interfaces (inputs/outputs)

- **Browser engine input:** `{ plan: Plan, seed: string (payload.hash), genre?: string }`
- **Browser engine output:** Handle with `start()` and `stop()`; no audio file.
- **Server WAV renderer input:** `plan`, `payload`, `hash`; output: `{ buffer, sha256, duration_ms, size_bytes }`.
- **Future offline render:** Same plan + payload; same genre pack semantics; output: WAV file for download/share.
