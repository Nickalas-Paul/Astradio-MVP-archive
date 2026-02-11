# FX Routing v1 – Changelog

## Summary
Redesigned mix/FX architecture: proper send/return buses (ROOM, PLATE, DELAY), reverb filtering to prevent bass bloom, reverb-return ducking, and bass fully dry. Fixes bass reverb immediately. No API/contract/plan changes; determinism preserved.

## Files touched
- **vnext/audio/wav-renderer.ts** – FX send amounts per channel (bass/kick/hat send 0; clap→ROOM moderate; harmony→PLATE light; melody→PLATE+DELAY subtle). HPF 250 Hz on reverb input, LPF 9 kHz on return. Reverb return duck on kick (fast attack, short recovery). Bass path fully dry.
- **vnext/scripts/fx-routing-verification.ts** (new) – Assert bass send ≈ 0, reverb_return_lowband_rms < 0.008, sha256 identical.
- **package.json** – Added `test:fx-routing-verification`.

## Behavior changes
- **Bass:** No reverb. Dry only.
- **Reverb:** Only clap, harmony, melody feed FX. HPF prevents bass from entering; LPF tames high wash.
- **Return duck:** Light duck on kick (18% depth, 2 ms attack, 35 ms recovery).

## Determinism
- All send amounts from `getFXSendAmounts(genre, seed)`. Same plan + hash ⇒ same audio.sha256.

## Commands
```bash
npm run vnext:build
npm run test:fx-routing-verification
VNEXT_INSTRUMENTATION_DEBUG=1 node dist/vnext/vnext/scripts/instrumentation-verification.js
```
