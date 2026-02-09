# Text Explainer V1 Parallel Build — Dev Note

**Branch:** beta-ui-vercel  
**Scope:** Additive-only changes to the TEXT EXPLAINER pipeline. No changes to Plan/events/audio pipeline, hashing contracts, or ML_REQUIRED fail-closed behavior.

---

## Touched Files and What Changed

### New files

| File | Purpose |
|------|--------|
| `vnext/explainer/astro-summary-from-snapshot.ts` | Builds `AstroSummary` from the same `EphemerisSnapshot` used for `encodeFeatures()`. Elements from featureVec 27–30 or snapshot.dominantElements; modality from payload when snapshot has none; deterministic `dominant_planets` (1–3) by priority + aspect involvement + longitude tie-breaker. |
| `vnext/explainer/plan-summary.ts` | `PlanSummary` type and `buildPlanSummary(plan)`: bpm, key, durationSec, melody/harmony event counts, avgMelodicInterval, registerMin/Max, encounterUniqueRoots, integrationTonicPull, densityBucket. Deterministic from plan data only. |
| `vnext/explainer/guidance-atoms.ts` | `GuidanceSummary` from featureVec 27–33: motion, gravity, shimmer, flow, tension, clustering as low/med/high buckets. No planner/astro imports. |
| `vnext/explainer/mapping-tables-v2.json` | Psychology/temperament language (V1-C): element_tints and astro_colors rewritten to expressive drive, structure, cognition, sensitivity; planet_tints as behavioral tone. v1 kept; v2 loaded by default with fallback to v1. |
| `vnext/scripts/explainer-determinism-test.ts` | T1: Runs compose twice with identical logical request (cache-busting keys); asserts explanation.sections (Theme/Details/Bullets) identical. |
| `vnext/scripts/explainer-alignment-report.ts` | T2: Prints payload.hash, featureHash, planHash, template_id (when present), element blend, dominant planets. Script-only; no route changes. |

### Modified files

| File | Changes |
|------|--------|
| `vnext/explainer/contracts.ts` | Extended `ExplainerAtoms` with optional `psych_tone`, `motion_profile_line`, `phase_story_lines`, `music_facts_line`, `gate_line`. Added `ExplainerInputs` (astro?, featureVec?, plan?). |
| `vnext/explainer/atoms-generator.ts` | `generateAtoms(payload, astro?, options?)` with `AtomsGeneratorOptions` (planSummary, guidanceSummary, gateReport). When options present: builds psych_tone, motion_profile_line, phase_story_lines, music_facts_line, gate_line. Mapping table load: try v2 first, then v1. Default astro `ts` set to `''` when not provided (no Date in explainer path). |
| `vnext/explainer/text-explainer.ts` | `generateExplanation(..., inputs?: ExplainerInputs)`. Builds astro, planSummary, guidanceSummary from inputs; passes them to `generateAtoms`. `generateOverlayExplanation` accepts optional `inputs` and forwards to `generateExplanation`. |
| `vnext/explainer/text-realizer.ts` | Load v2 mapping table first, fallback v1. Short: use `psych_tone ?? astro_color` as tone line. Long: add phase_story_lines + music_facts_line paragraph and disclaimer line; length cap unchanged. Bullets: add motion_profile_line and music_facts_line when present; gate_line in fail path. |
| `vnext/api/compose.ts` | After `featureVec = encodeFeatures(snapshot)`: `astro = astroSummaryFromSnapshot(snapshot, featureVec, payload.modality)`; `explainerInputs = { astro, featureVec, plan }`. All `generateExplanation` and `generateOverlayExplanation` calls receive `explainerInputs`. No change to plan generation, gates, or audio. |

---

## What Was Not Changed

- **Plan / events / audio:** `plan-generator.ts`, `planner/narrative.ts`, `audition-gate.ts`, `wav-renderer`, `midi`, `critics` thresholds — unchanged.
- **Hashing:** `payload.hash`, `computePlanHash`, explanation hash, control hash — unchanged. No new hash fields in contracts.
- **ML_REQUIRED / fail-closed:** Gate pass/fail logic and calibrated thresholds unchanged. Explainer still uses `gateReport.calibrated.overall` for fail-closed text; new `gate_line` only describes failure class when gates fail.
- **Determinism:** No `Date.now()`, `new Date()`, or `Math.random()` in explainer additions. All variation seeded by `payload.hash`.

---

## Confirmation: No Audio Pipeline Logic Modified

- `encodeFeatures` is still only used for `generatePlanMLOnly(featureVec, payload)` and is not modified.
- `generatePlanMLOnly` signature and behavior unchanged; it is not given the real snapshot (only payload as chartContext) and that pre-existing behavior is unchanged.
- Plan → events → WAV path is untouched. The explainer now receives the same `plan` and `featureVec` that were already computed for the response; it does not affect how they are computed.

---

## How to Run

- **Determinism test:** `npm run vnext:build` then `node dist/vnext/vnext/scripts/explainer-determinism-test.js`
- **Alignment report:** `node dist/vnext/vnext/scripts/explainer-alignment-report.js` (after build; mocks `fetch` for chart-snapshot)
