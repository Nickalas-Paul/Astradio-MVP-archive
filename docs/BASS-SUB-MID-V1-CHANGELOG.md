# Bass Sub+Mid v1 (Option A) – Changelog

## Summary
Clean, deep, minimal house bass: two-layer synthesis (sub anchor + mid character) to fix "tin can laptop bass." Sub provides true fundamental weight; mid adds light presence for small speakers. Sub dominates (70–85% of bass RMS). No API/contract/plan changes; determinism preserved.

## Files touched
- **vnext/audio/wav-renderer.ts** – Bass: two-layer (sub sine + mid saw/square), LPF 120 Hz on sub, LPF 700–1100 Hz + light saturation on mid, HPF 35–40 Hz on combined, sidechain duck on combined. Debug: sub/mid peak/RMS when `VNEXT_INSTRUMENTATION_DEBUG=1`.

## Behavior changes
- **Sub anchor:** Sine, fundamental from pitch, LPF 120 Hz, near-zero saturation, attack 8–15 ms, release 180–320 ms, 70–85% of bass energy.
- **Mid character:** Saw or square (seeded), ±3 cents detune (seeded), LPF 700–1100 Hz, saturation 0.02–0.06 after LPF, faster release (0.7–0.85 of sub), 15–30% of bass energy.
- **Combined:** HPF 35–40 Hz removes rumble; duck applied to sum; fully mono, no reverb/widen.

## Determinism
- All params from `payload.hash` + stable keys (`palette:bass:*`, `bass:subShare`, etc.). Same plan + hash ⇒ same audio.sha256.

## Commands
```bash
npm run vnext:build
npm run test:audio-determinism
npm run test:instrumentation-verification
npm run test:mix-balance-verification
npm run test:harmony-blend
VNEXT_INSTRUMENTATION_DEBUG=1 node dist/vnext/vnext/scripts/instrumentation-verification.js
```
