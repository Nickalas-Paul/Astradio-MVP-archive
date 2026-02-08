# Changelog: Color-Shift Harmony Blending

## Summary
Harmony behaves like light changing color: blended overlaps and softer attacks. Same inputs ⇒ same plan_sha256 and audio.sha256 (deterministic).

## Touched files

### 1) vnext/planner/narrative.ts
- **Harmony bed overlap:** After emitting harmony events (3 per bar), a post-pass extends each chord’s `t1` by a deterministic overlap (5–12% of bar duration, cap 0.35 s) from `guidance.flow` + `elementBlend` (more water/air ⇒ more overlap; fire ⇒ less; earth ⇒ moderate).
- **Voice stagger:** Note-off times are staggered by voice index (0.018 s per voice) so chord tones don’t end at once.
- **Clamping:** Extended `t1` is clamped to the next chord’s end (`nextChordT0 + barSec`) and plan duration so overlaps never exceed one bar into the next chord.
- Melody and bass logic unchanged; melody sustain caps unchanged.

### 2) vnext/audio/wav-renderer.ts
- **Harmony attack:** ADSR attack range for harmony set to 20–40 ms (was 10–25 ms) for softer chord entrances.
- **Harmony release:** Release range set to 120–250 ms (was 220–450 ms) for a controlled tail and less risk of clicks.
- All parameters remain derived from `seed` (payload.hash); no `Math.random` / `Date.now`.

### 3) vnext/scripts/harmony-blend-regression.ts (new)
- Asserts harmony overlap exists: at least one chord has `nextChordT0 < max(t1)` for its notes.
- Asserts determinism: render twice ⇒ same `audio.sha256`.
- Asserts harmony note duration ≤ 8 s.

### 4) package.json
- Added script: `test:harmony-blend` → runs harmony-blend-regression.js after build.

## Commands

**Harmony blend regression (overlap + determinism + max sustain):**
```bash
npm run test:harmony-blend
```

**Determinism (plan + melody caps):**
```bash
npm run test:mirror-determinism
```

**Audio renderer determinism (fixed plan, same WAV twice):**
```bash
npm run vnext:build && node dist/vnext/vnext/scripts/audio-renderer-determinism.js
```

## Not changed
- server/index.js, apps/web/*, vnext/api/compose.ts, vnext/contracts.ts, vnext/feature-encode.ts, vnext/plan-hash.ts
- Critics (no changes)
- Request/response shapes and hashing
