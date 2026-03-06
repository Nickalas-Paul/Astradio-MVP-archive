# Phase 8 — Lyria-only audio (permanent contract)

**Status:** Permanent. No legacy fallbacks, no sample-based engine, no Tone.js playback in the web app.

## Contract

- **Lyria is the only** acceptable audio output in all environments (local dev, preview, production, CI).
- No fallback to browser-performance-engine, Tone.js sampler/synth, or any sample-based system. Ever.
- If the Lyria artifact is missing or invalid, the app **fails closed** with an explicit UI message (e.g. "Audio unavailable (Lyria-only)").
- Enforced at **build-time** (CI guard) and **runtime** (single playback module, dead legacy modules).

## Single playback path

- **Module:** `apps/web/src/core/audio/lyria-playback.ts`
- **API:** `playLyriaAudio(payload)`, `getPlayableLyriaUrl(payload)`, `stopLyriaPlayback()`
- **Input:** `payload.audio.url` or `payload.audio.base64` only. No `/audio/samples/` URLs.
- **Playback:** HTMLAudioElement only (`new Audio(url).play()`). No Tone.js.

## Guards

- **Source guard:** `npm run phase8:audio-guard` — fails if Tone, `/audio/samples/`, or legacy engine is referenced in `apps/web/app` or `apps/web/src`.
- **Build verification:** `npm run phase8:verify-build` — runs guard, builds web, greps `.next` for legacy module/pack references; fails if present.

## Surfaces

All playback uses the Lyria module (or `LyriaAudio` component backed by it):

- Home: `playLyriaAudio` / `stopLyriaPlayback`
- Sandbox: `getPlayableLyriaUrl` → `<audio src={…} />`
- EnhancedTransport: `getPlayableLyriaUrl` → audio element
- RPG Campaign: `<LyriaAudio url={artifact_url} />`

## Legacy code

- `browser-performance-engine.ts` and `genre/house.ts` are **dead modules** (throw on import).
- `genre/index.ts` — `getGenrePack()` throws. Types still exported for compatibility.
