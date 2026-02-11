# Provenance Hashes & Genre Scaffolding (House) – Changelog

## Summary
Additive upgrade: (A) end-to-end provenance hashes (snapshot → featurevec → v6 → plan → wav) and (B) genre scaffolding with default "house" idioms. No API/contract changes; determinism preserved.

## Files touched
- **vnext/api/compose.ts** – Canonical hashing helpers (`hashSnapshot`, `hashFeatureVec`, `hashV6`); provenance object in response; genre field in payload generation (default "house"); replace `mock_chart_hash` with real snapshot hash.
- **vnext/plan-generator.ts** – Return v6 vector in diag for provenance; pass genre to planner via guidance.
- **vnext/planner/narrative.ts** – House idioms: 4-on-the-floor rhythm + hats + clap; syncopated bassline; harmony stabs in Recognition; melody motif repetition (call/response).
- **vnext/explainer/contracts.ts** – Add optional `genre` field to `ControlSurfacePayload`.
- **vnext/scripts/provenance-verification.ts** (new) – Verify deterministic hash chain; assert same inputs → same hashes, small change → different hashes.
- **package.json** – Add `test:provenance-verification` script.

## Behavior changes
- **Provenance:** Response includes `artifacts.provenance` with `snapshot_sha256`, `featurevec_sha256`, `v6_sha256`, `model_id`, `model_sha`, `plan_sha256`, `audio_sha256`, `payload_hash`, `encoder_version`, `features_version`. All hashes deterministic and stable.
- **Genre:** Default genre is "house". When `genre === 'house'`, planner applies house idioms:
  - Rhythm: 4-on-the-floor kick (or half-time if activation < 0.4), hats on offbeats, clap on beats 1&3, occasional ghost hat.
  - Bass: Root/fifth with syncopated pickups tied to Mars/Mercury; avoids walking bass.
  - Harmony: Chord stabs (short events) on offbeats in Recognition phase.
  - Melody: More motif repetition (phrases 1-2 same, phrase 3 variation, phrase 4 return); reduced filler in Recognition.
- **Determinism:** Same inputs → same provenance hashes → same plan_sha256 → same audio.sha256. All variation seeded by payload.hash.

## Determinism
- Same request/snapshot/payload.hash → same FeatureVec → same v6 → same plan → same plan_sha256 and audio.sha256.
- No Math.random/Date.now. Provenance hashes use canonical serialization (stable key order, fixed precision).
- Chart timestamp fallback already uses `chartContext.ts ?? chartContext.date ?? ""` (no Date fallback).

## Commands
```bash
npm run vnext:build
npm run test:mirror-determinism
npm run test:harmony-blend
npm run test:provenance-verification
```

## Verification
- `test:provenance-verification` confirms: same inputs → identical hashes; small chart change → snapshot/featurevec/v6 differ.
- Default genre is "house"; house idioms audible (kick pattern + hats + clap + bass grammar).
