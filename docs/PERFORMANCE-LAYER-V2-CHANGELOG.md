# Performance Layer v2 & Less-Grid Harmonic Rhythm – Changelog

## Summary
Reduce robotic/formulaic feel via (A) phrase-level performance contour and rubato in the WAV renderer, (B) deterministic harmonic rhythm templates (onset offsets + color morph) in the planner, and (C) varied melody filler with rests before cadences. No API/contract changes; determinism preserved.

## Files touched
- **vnext/audio/wav-renderer.ts** – Phrase envelope (4 phrases over 16 bars), velocity arc (rise/peak/fall + breath dip), phrase-boundary rubato (seeded t0 shift + release lengthening). Applied to melody/harmony most, bass subtler, rhythm minimal.
- **vnext/planner/narrative.ts** – Harmonic onset offsets per phase (Encounter 0; Recognition 0/1.5; Integration cadence 2); mid-bar color morph (add 7th at beat 2) in Encounter; melody filler with varied durations (0.25/0.5/0.75) and rest before cadence (filler in cadence bar only on beats 0–1).
- **vnext/scripts/performance-verification.ts** (new) – Prints velocity-by-phrase and harmony onset distribution; asserts harmony onsets vary (not all at 0.0).
- **package.json** – Added `test:performance-verification` script.

## Behavior changes
- **WAV:** Same plan + hash → same WAV. Velocity is scaled by a deterministic phrase envelope (arc + breath dip). Near phrase boundaries, event t0 gets a small seeded rubato shift and release is lengthened.
- **Plan:** Harmony events may start at 0, 1.5, or 2 beats within the bar (phase-dependent, seed-driven). Encounter gets one 7th “color morph” note per phrase at beat 2. Melody filler uses 0.25/0.5/0.75 beat durations and avoids beats 2–3 in cadence bars.

## Determinism
- Same inputs ⇒ same plan ⇒ same plan_sha256; same plan + hash ⇒ same audio.sha256. All variation is seeded (payload.hash + channel/bar/eventIndex). No Math.random/Date.now.

## Commands
```bash
npm run vnext:build
npm run test:mirror-determinism
npm run test:harmony-blend
npm run test:performance-verification
```
