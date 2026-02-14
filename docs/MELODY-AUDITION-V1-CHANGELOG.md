# Melody Audition V1 – Changelog

## Summary

Shifted from **repairing a single melody** to **auditioning multiple melody candidates** and selecting the best via a **soft scorer**. Goals: improve listenability and novelty without adding rigid rules; keep determinism and Plan/EventToken contracts unchanged.

## Changes

### A) Melody candidate generation

- **Location**: `vnext/planner/narrative.ts`
- **Mechanism**: For each plan, we now build **N melody variants** (default 6, configurable via `VNEXT_MELODY_CANDIDATES`, clamped 4–8).
- **Base candidate** (index 0): Uses the existing transformation sequence, phrase centers, and B lift from the main seed.
- **Variants** (indices 1..N-1): Same structure but with:
  - Deterministic **transformation sequence** chosen via `selectTransformationSequence(candidateSeed, ...)`.
  - **Density jitter** (rest/note balance) from `jitter01(candidateSeed, 'density')`.
  - **Phrase register centers** jittered ±1 via `hashMod(candidateSeed, 'center', 3)`.
  - **B section lift** 2 or 3 via `hashMod(candidateSeed, 'blift', 2)`.
  - **Filler seed** derived from `candidateSeed` so each candidate gets distinct filler.
- **Seeding**: Candidate `i` uses seed `${seed}:melodyCandidate:${i}` so same snapshot + payload.hash ⇒ same N candidates and same selection.
- **Repair**: Each candidate is still passed through `applyMelodyGrammarRepair` before scoring; the audition chooses among repaired candidates rather than adding new repair logic.

### B) Soft melody scorer

- **Location**: `vnext/planner/melody-audition.ts`
- **API**: `createSoftMelodyScorer(ctx)` returns a function `(melody: EventToken[]) => number`.
- **Context**: `hookCell`, `getChordTonesForBar`, `secondsPerBeat` (and phrase boundaries) for chord-tone and phrase-contrast terms.
- **Criteria** (all soft; no hard cutoffs):
  - **Hook recurrence**: Soft peak around ~8 occurrences (recognizable but not overused).
  - **Chord-tone on strong beats**: Soft band (prefer good rate, no hard threshold).
  - **Stepwise rate**: Soft band to avoid monotone scales and constant leaps.
  - **Leap resolution**: Prefer resolved leaps (soft reward).
  - **Rest density**: Prefer “enough” breathing room (soft band).
  - **Phrase contrast**: B section higher register or density than A; final A feels like return (soft reward).
  - **Novelty**: Penalize repeated identical 1-bar pitch sequences (bar-to-bar repetition).
- **Helpers**: `softPeak(value, target, width)`, `softBand(value, lo, hi, margin)` used so scoring remains smooth and expressive.

### C) Integration in narrative

- **Location**: `vnext/planner/narrative.ts`
- **Flow**:
  1. Define `getChordTonesForBar(bar)` once (used by scorer and repair).
  2. `buildOneMelodyCandidate(candidateSeed)` builds one full melody (hook cells + filler) with the jitters above.
  3. `buildOneWithRepair(candidateSeed)` = build one candidate then `applyMelodyGrammarRepair(..., { seed: candidateSeed, ... })`.
  4. `auditionMelodyCandidates(buildOneWithRepair, seed, scorer, N)` builds N candidates, scores each, returns `{ melody, selectedIndex, scores }`.
  5. The **winning melody** events are pushed into the plan’s `events`; then bass, harmony, and rhythm are added as before.
- Harmony, bass, and rhythm generation are **unchanged**; only the melody source is the winner of the audition.

### D) Debug and verification

- **Plan.debug** (optional) additions:
  - `melodyCandidateCount`: N.
  - `melodyCandidateScores`: array of scores (e.g. first 8).
  - `melodySelectedIndex`: index of the chosen candidate.
  - Existing fields (e.g. `hookCellId`, `hookCellOccurrences`, `sectionCellUsage`, chord-tone/stepwise/leap/rest metrics) remain and refer to the **chosen** melody.
- **Verification** (`vnext/scripts/plan-novelty-verification.ts`):
  - Prints candidate count, selected index, top-3 scores, and “chosen score is max”.
  - **Determinism**: Same seed + inputs ⇒ same `melodySelectedIndex`, same `melodyCandidateCount`, and same `melodyCandidateScores` (within epsilon).
  - **Audition assertions**: `candidateCount >= 4`; chosen score equals `max(scores)` (or within 1e-9 for ties).
  - **Novelty**: Different seed ⇒ often different `melodySelectedIndex` (reported as PASS/WARN).

## Determinism and constraints

- **Determinism**: Same snapshot + payload.hash + env ⇒ same N candidates, same scores, same chosen melody ⇒ same plan_sha / audio_sha.
- **No `Math.random` / `Date.now`** in generation or scoring; all jitter and selection use the seeded RNG/keys.
- **No API breaks**: Plan and EventToken contracts unchanged; new debug fields are optional.
- **Plan as single source of truth**: Playback does not recompute notes; the chosen melody is the one written into the plan.

## Configuration

- **`VNEXT_MELODY_CANDIDATES`**: Number of melody candidates to generate (default 6; clamped to 4–8). Same value must be used for deterministic comparison across runs.

## Files touched

- **New**: `vnext/planner/melody-audition.ts` (scorer + `auditionMelodyCandidates`).
- **Modified**: `vnext/planner/narrative.ts` (jitter helpers, `buildOneMelodyCandidate`, `buildOneWithRepair`, audition call, debug fields).
- **Modified**: `vnext/contracts.ts` (Plan.debug: `melodyCandidateCount`, `melodyCandidateScores`, `melodySelectedIndex`).
- **Modified**: `vnext/scripts/plan-novelty-verification.ts` (melody audition output and assertions).
- **New**: `docs/MELODY-AUDITION-V1-CHANGELOG.md` (this file).

## Acceptance

- Existing tests still pass.
- Verification script asserts: candidateCount ≥ 4, selectedIndex stable under repeated runs, chosen score is max (or within epsilon for ties).
- Musical goal: output less formulaic, with hook identity intact and phrase-level contrast.
