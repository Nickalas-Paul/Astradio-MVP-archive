# Personality Profile v1 (Sonic Mirror) – Changelog

## Summary
Additive upgrade: 60s “personality mirror” with Core Identity, Inner World, and Expressive Style. Outer planets (Pluto/Neptune/Uranus) remain subtle undertones.

## Files touched
- **vnext/astro/personality-profile.ts** (new) – `PersonalityProfileV1` type and `computePersonalityProfileV1()` (deterministic from FeatureVec + EphemerisSnapshot + seed).
- **vnext/astro/guidance.ts** – `guidanceFromFeatures(..., seed?)` now computes and returns `personality: PersonalityProfileV1`.
- **vnext/planner/narrative.ts** – Uses `guidance.personality` for harmony (gravity, Venus voicing, overlap), melody (Mercury/Mars, reveal-based min melody), rhythm (Recognition + mars.propulsion), and subtle Pluto undertone in bass.
- **vnext/plan-generator.ts** – Determinism fix: chart timestamp uses `chartContext.ts ?? chartContext.date ?? ""` (no `new Date().toISOString()`). Passes payload hash as seed to `guidanceFromFeatures`.
- **vnext/scripts/mirror-report.ts** – Passes hash to `guidanceFromFeatures`; prints one-line personality (temperament, moon, venus, mars, outers, reveal.recognition) for first input.

## Behavior changes
- **Guidance:** New field `personality` (version `pp.v1`) with temperament, subsystems (moon/sun/mercury/venus/mars/saturn/outers), emphasis, reveal weights, and seed.
- **Plan:** Same Plan/EventToken schema. Harmony favors root/voicing and overlap by gravity, Venus, moon permeability. Melody density/velocity and rhythm presence scale with reveal and Mercury/Mars. One sparse, low-velocity bass undertone when plutoDepth > 0.1. No API or contract changes.

## Determinism
- Same request/snapshot/payload.hash ⇒ same FeatureVec ⇒ same guidance (including personality) ⇒ same plan ⇒ same plan_sha256 and audio.sha256.
- No `Math.random` or `Date.now` in plan or WAV paths. Personality and planner use only payload hash and existing snapshot/feature data.
- Chart timestamp fallback no longer uses `new Date().toISOString()`, so missing timestamp does not introduce non-determinism.

## Commands
```bash
# Build
npm run vnext:build

# Determinism
npm run test:mirror-determinism
npm run test:harmony-blend

# Personality print (first input)
npm run mirror-report
```
