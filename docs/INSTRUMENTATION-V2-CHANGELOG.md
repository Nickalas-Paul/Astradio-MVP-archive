# Instrumentation Layer v2 – Changelog

## Summary
Band-limited synthesis and proper reverb send bus: polyBLEP saw/square for bass mid layer, reverb HPF 180–260 Hz / LPF 7–10 kHz, pre-delay 15–30 ms. Bass remains dry and mono. Fixes tinny aliasing and reverb splash. No API/contract/plan changes; determinism preserved.

## Files touched
- **vnext/audio/wav-renderer.ts** – polyBLEP saw/square for bass mid; reverb HPF/LPF seeded (180–260, 7–10k), pre-delay 15–30 ms; reverbSendAmounts in FxRoutingStats.
- **vnext/scripts/reverb-send-verification.ts** (new) – Asserts bass_reverb_send==0, kick_reverb_send==0, harmony_reverb_send>0, determinism.
- **package.json** – Added `test:reverb-send-verification`.

## Behavior changes
- **Bass mid:** Band-limited saw/square (polyBLEP) instead of naive oscillator; less aliasing at 22k/44k.
- **Reverb:** HPF 180–260 Hz and LPF 7–10 kHz on reverb input; pre-delay 15–30 ms (seeded); bass/kick send 0.
- **Debug:** reverb_send_totals (kick, bass, harmony) when `VNEXT_INSTRUMENTATION_DEBUG=1`.

## Determinism
- HPF, LPF, pre-delay from `payload.hash` + stable keys (`rev:hpf`, `rev:lpf`, `rev:predelay`). Same plan + hash ⇒ same audio.sha256.

## Commands
```bash
npm run vnext:build
npm run test:audio-determinism
npm run test:instrumentation-verification
npm run test:mix-balance-verification
npm run test:harmony-blend
npm run test:reverb-send-verification
npm run test:fx-routing-verification
VNEXT_INSTRUMENTATION_DEBUG=1 node dist/vnext/vnext/scripts/instrumentation-verification.js
```
