# Text Generation Engine v1.0

**Scope:** New ExplainSpec-based text generation engine. Treats text like MIDI: a derived artifact from canonical inputs (snapshot/features/guidance/plan), not hand-written prose.

**Date:** 2026-02-08

---

## Architecture

### ExplainSpec as Stable Interface

- **vnext/explainer/spec-contracts.ts**: Type definitions for `ExplainSpec`, `SignatureFacts`, `PsychologyFacts`, `MusicFacts`, `ComparisonFacts`, etc.
- ExplainSpec is the single source of truth for what we claim. Rendering is separate and can evolve.

### Text Generation Engine

- **vnext/explainer/text-generation-engine.ts**: 
  - `buildExplainSpecSingle()`: Builds ExplainSpec from canonical pipeline inputs
  - `buildExplainSpecComparison()`: Stub for future overlay/compatibility mode
  - Deterministic: all variation seeded by `payload.hash`
  - Reuses existing helpers: `astroSummaryFromSnapshot`, `guidanceSummaryFromFeatureVec`, `buildPlanSummary`

### Deterministic Renderer

- **vnext/explainer/renderers/deterministic.ts**:
  - `renderExplainSpecToSections()`: Converts ExplainSpec to `ExplanationSection[]`
  - Rules: no duplicate sentences, no inline bullet glyphs, no em dashes, complete sentences
  - Output: Astrological Signatures (2-4 sentences), Personal Significance (1-2 paragraphs), Musical Identity and Flow (1 paragraph + 3-6 bullets)

### Integration

- **vnext/api/compose.ts**: 
  - After snapshot/featureVec/plan/gates computed, builds `guidanceSummary` and `planSummary`
  - Builds ExplainSpec using `buildExplainSpecSingle()`
  - Renders to sections using `renderExplainSpecToSections()`
  - Sets `response.explanation.sections` from rendered sections
  - Preserves legacy text fields for backward compatibility
  - Overlay mode still uses legacy explainer (comparison mode TODO)

---

## Tests

- **vnext/scripts/explain-spec-determinism-test.ts**: Run compose twice with identical inputs, assert sections identical
- **vnext/scripts/explain-spec-shape-test.ts**: Assert sections have correct structure (ids in order, bullets only in musical, no "•" or "—" in text)

---

## Future Scaling Hooks

- **Comparison mode**: `buildExplainSpecComparison()` stub exists; renderer supports comparison titles ("Shared Signatures", "Points of Friction and Growth", "Musical Relationship and Blend")
- **Sandbox mode**: Can pass edited "synthetic" signatures into ExplainSpec builder without snapshot; mark `evidence.kind="synthetic"` and keep determinism

---

## Confirmation

**No changes to:**
- Plan generation (`plan-generator.ts`, `planner/narrative.ts`)
- Events structure (`contracts.ts` EventToken, Plan)
- Audio pipeline (`audio/wav-renderer.ts`, `midi/plan-to-midi.ts`)
- Hashing contracts (`plan-hash.ts`, compose hash computation)
- ML_REQUIRED fail-closed behavior (`audition-gate.ts`)

**Determinism preserved:**
- All variation seeded by `payload.hash` (no Date.now, Math.random)
- Same inputs → same ExplainSpec → same rendered sections

---

## Sample ExplainSpec (single mode)

```json
{
  "specVersion": "ExplainSpecV1",
  "mode": "single",
  "seed": "abc123...",
  "titles": {
    "signatures": "Astrological Signatures",
    "significance": "Personal Significance",
    "musical": "Musical Identity and Flow"
  },
  "single": {
    "signatures": {
      "elementBlend": { "fire": 0.4, "earth": 0.2, "air": 0.3, "water": 0.1 },
      "dominantPlanets": ["Mars", "Venus"],
      "tensionBucket": "med",
      "clusteringBucket": "high"
    },
    "psychology": {
      "temperamentWords": ["energetic", "passionate"],
      "attentionStyle": "focused",
      "pacing": "measured",
      "relatingStyle": "direct"
    },
    "music": {
      "bpm": 100,
      "key": "C",
      "densityBucket": "balanced",
      "registerBias": "mid",
      "articulationBucket": "med",
      "motionBucket": "med",
      "harmonicPosture": "root-stable",
      "arcSummary": {
        "begin": "Encounter introduces 3 harmonic colors",
        "middle": "Recognition unfolds with 4.2-semitone motion",
        "end": "Integration resolves with tonic emphasis"
      },
      "planSummary": { ... }
    }
  },
  "listeningCues": [
    "Mars's influence shapes the movement",
    "fire element brings energy",
    "Tempo sits at 100 BPM",
    "Density is balanced"
  ],
  "evidence": [
    { "kind": "feature", "key": "feature[32]", "value": 0.5, "note": "Tension level" },
    { "kind": "plan", "key": "plan.bpm", "value": 100, "note": "Tempo" }
  ]
}
```

---

## Backward Compatibility

- Legacy `explanation.text` fields still populated (from rendered sections)
- Legacy Theme/Details/Bullets sections still supported (fallback when structured fields missing)
- UI (`ExplanationPanel.tsx`) already handles both new and legacy section formats
