# Music Quality Improvements – Planner Summary

## Scope
Improvements to **rhythmic and melodic musicality** by changing only the planner layer that generates `Plan.events`. No changes to API request/response shapes, caching keys, determinism rules, WAV renderer, or MIDI export logic (MIDI reflects the updated Plan deterministically).

---

## 1. Planner Changes (vnext/planner/narrative.ts)

### 1.1 Deterministic 16th-note grid
- **Grid:** All event times use a **16th-note grid** (4 subdivisions per beat).
- **Quantizer:** `quantizeTo16th(timeSec, bpm)` snaps `t0` and `t1` to the grid deterministically.
- **Minimum duration:** If quantized `t1 <= t0` (e.g. very short rhythm hits), `t1` is set to `t0 + one 16th` so no events are dropped and rhythm channel stays audible.

### 1.2 Deterministic phrase structure (60s, 4-bar blocks)
- **Phrase roles:** Each 4-bar phrase uses bar roles: **motif → variation → tension → cadence**.
- **Melody density by role:**  
  - **Motif:** base drops from density.  
  - **Variation / Tension:** `min(3, baseDrops + 1)`.  
  - **Cadence:** `max(1, baseDrops - 1)`.  
  So density varies across the phrase (not flat).
- **Slots:** Melody slots within a bar are 16th-aligned (e.g. 0, 2 or 0, 4/3, 8/3 for 2 or 3 drops).
- **Cadence:** Last beat of each 4-bar phrase still gets the cadence note as before.

### 1.3 Deterministic plan id
- **Before:** `id: plan_${Date.now()}` (non-deterministic).
- **After:** `id: plan_${guidance.seed.slice(0,32)}` when `guidance.seed` is provided; else `plan_v6_${bpm}_${phraseCenters.join("_")}`.
- **Seed:** `plan-generator` passes `guidanceWithSeed` with `seed: payload.hash` (or `"seed"`) so same request ⇒ same plan id ⇒ stable plan hash and soak.

### 1.4 Unchanged
- Plan schema, BPM/key, melody/harmony/bass/rhythm channels, MOTIFS/CADENCE_ENDS, bass ostinato, harmony triads, and rhythm kick/hat pattern are unchanged. Only timing (grid + phrase roles) and id are updated.

---

## 2. Audition / Critics

### 2.1 New metrics (no gate fail at 0)
- **Duration variety** (`critics`): Score from distribution of event durations; low when almost all events share the same duration.  
  Threshold in `audition-gate`: **0** (metric only; does not fail the gate).
- **Density curve** (`critics`): Score from variance of events-per-bar (excluding harmony). Low when density is flat.  
  Threshold in `audition-gate`: **0** (metric only).

### 2.2 Rhythm critic fixes
- **Durations:** Rhythm events now use `e.t1 - e.t0` instead of `(e as any).duration`.
- **Determinism:** Harmony/rhythm placeholder scorers (e.g. `calculateSyncopation`, `calculateProgressionLegality`) use a deterministic hash-based value in `[0.5, 1.0]` instead of `Math.random()`, so same plan ⇒ same score and soak is stable.

---

## 3. Before/After – Event Stats (conceptual)

| Metric | Before | After |
|--------|--------|--------|
| **Grid** | Quarter-note (PPQ 4) | 16th-note (GRID_16 = 4 per beat) |
| **t0/t1** | Rounded to quarter | Rounded to 16th |
| **Notes per channel** | Melody/bass/harmony/rhythm as before | Same; rhythm kept (min 1 16th if quantized duration collapsed) |
| **Unique durations** | Several (1, 2, 4 beats; 0.05, 0.1 for rhythm) | Same spread + 16th-aligned; rhythm has ≥ 1 16th |
| **Density curve** | Same motif drops every bar (flat by bar) | Varies by phrase role (motif/variation/tension/cadence) ⇒ non-flat |
| **Plan id** | Non-deterministic | Deterministic from seed |

---

## 4. Determinism

- **Soak:** `ENABLE_WAV_EXPORT=1 npm run test:compose-soak` → **20/20 passes**, same `audio.sha256` across runs (e.g. `be587a8b823dbc36...`).
- **Plan hash:** `npm run test:plan-hash` → all tests pass (same plan ⇒ same hash; reordered events canonicalize to same hash).
- **MIDI:** `npm run test:midi-determinism` → same plan ⇒ same MIDI SHA256/base64.

Same input (request + chart snapshot) ⇒ same plan ⇒ same WAV and MIDI.

---

## 5. Files Touched

- **vnext/planner/narrative.ts** – 16th grid, phrase roles, deterministic id, min duration for push.
- **vnext/plan-generator.ts** – Pass `guidanceWithSeed` (includes `seed`) to `planFromVector`.
- **vnext/critics/index.ts** – Rhythm durations from `t1-t0`; `duration_variety` and `density_curve`; deterministic placeholders for harmony/rhythm.
- **vnext/audition-gate.ts** – `duration_variety` and `density_curve` in THRESH (0 = metric only).

No changes to: API shapes, caching keys, WAV renderer, MIDI export, or golden/soak harness logic (only planner and critics/audition as above).
