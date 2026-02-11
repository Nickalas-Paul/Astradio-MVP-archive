# Mix Balance v1 – Changelog

## Summary
Additive improvements to house listenability: fix bass dominance, refine sidechain duck, add deterministic mix bus glue, and per-channel debug metrics. No API/contract/plan changes; determinism preserved.

## Files touched
- **vnext/audio/wav-renderer.ts** – Bass: reduced gain (0.55–0.68), amp attack 8–20ms (remove click), shorter release (0.72–0.88 scale), warmer LPF (1400–2200 Hz), less saturation (0.03–0.08). Sidechain: envelope-based duck (fast attack, short hold, fast recovery), bass depth 0.22, harmony 0.10. Mix bus: gentle compression (thr 0.4, ratio 3) + light soft clip (tanh). Debug: per-channel peak/RMS and bass_to_master_ratio when `VNEXT_INSTRUMENTATION_DEBUG=1`. Optional `returnChannelStats` for verification.
- **vnext/scripts/mix-balance-verification.ts** (new) – Determinism + bass ≤ kick×1.4, kick_peak ≥ 0.08.
- **package.json** – Added `test:mix-balance-verification`.

## Behavior changes
- Bass no longer peaks above kick transient; softer onset, shorter tail, warmer tone.
- Sidechain duck is more glue-like (less pumping).
- Master bus has gentle compression and soft clip for headroom.
- `RenderOptions.returnChannelStats` returns per-stem peak/RMS for tests.

## Determinism
- All new parameters are seed-derived. Same plan + hash ⇒ same audio.sha256.

## Commands
```bash
npm run vnext:build
npm run test:mix-balance-verification
npm run test:instrumentation-verification
VNEXT_INSTRUMENTATION_DEBUG=1 node dist/vnext/vnext/scripts/instrumentation-verification.js
```
