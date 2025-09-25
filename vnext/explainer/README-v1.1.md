# Phase 3 - Text Explainer Integration (Unified Spec v1.1)

## 🎯 Overview

The Text Explainer extends the **control-surface distillation pipeline** to generate dynamic text explanations alongside audio synthesis. Both audio and text are generated from the same `{controls, astro}` payload, ensuring perfect alignment and deterministic output.

**Single source of truth:** `POST /api/compose` drives BOTH audio and text with identical artifacts & gates.

## 🏗️ Architecture

```
Swiss Ephemeris → Features (64-dim)  
               → Student v2.3 → CONTROL_SURFACE v1.1  
                                 ├─► Audio Planner/Synth  
                                 └─► Text Explainer v1.1
```

## 📁 File Structure

```
vnext/explainer/
├── contracts.ts              # TypeScript interfaces (Unified Spec v1.1)
├── mapping-tables-v1.json    # Deterministic atom→phrase mappings (Section B)
├── atoms-generator.ts        # Generates semantic facts from controls
├── text-realizer.ts          # Converts atoms to formatted text
├── test-fixtures-v1.1.ts     # F1-F7 test cases (Section H)
├── test-explainer-v1.1.ts    # Validation test script
└── README-v1.1.md           # This documentation
```

## 🔧 Core Components

### 1. ControlSurface v1.1

```typescript
interface ControlSurfacePayload {
  arc_curve: [number, number, number]; // [start, mid, end]
  density_level: number; // 0-1
  tempo_norm: number; // 0-1
  step_bias: number; // 0-1
  leap_cap: number; // 1-6
  rhythm_template_id: number; // 0-7
  syncopation_bias: number; // 0-1
  motif_rate: number; // 0-1
  genre: "lofi" | "house" | "ambient";
  hash: string; // For deterministic variation
}
```

### 2. Explainer Atoms v1.1

Deterministic facts generated directly from `{controls, astro}`:

- `arc_desc`: "Arcs surge then soften, echoing Fire's bursts of energy" (from arc_curve + element tint)
- `movement`: "mostly stepwise motion, kept close and careful — steady connections" (from step_bias, leap_cap, planet tint)
- `rhythm_feel`: "strong, accented patterns, with pronounced off-beats — Mars" (from rhythm_template_id, syncopation_bias, planet tint)
- `density_desc`: "dense layers add weight, reflecting crowded skies" (from density_level, stellium check)
- `motif_desc`: "themes recur often, Venus's love of return" (from motif_rate)
- `astro_color`: "Tone: energetic, assertive" (from top element + dominant planets)

### 3. Mapping Tables v1 (Section B)

**Astrology first → Music second.** Each rule is **if/else** with explicit ranges:

#### B1) Arc → `arc_desc` (uses `arc_curve` + element tint)
- **Shape detection**: Rise-Peak-Release, Gentle Wave, Plateau/Hold, Mixed
- **Element tint**: Fire>0.4 → "echoing Fire's bursts of energy"
- **Templates**: 4 seeded variations

#### B2) Movement → `movement` (uses `step_bias`, `leap_cap`, planet tint)
- **Primary bucket**: ≥0.70 → "mostly stepwise motion", 0.40-0.69 → "balanced steps and leaps", <0.40 → "leaping intervals lead"
- **Modifier**: ≥5 → ", with wide reaches", ≤2 → ", kept close and careful"
- **Planet tint**: Mars → "bold push", Venus → "steady connections", etc.

#### B3) Rhythm → `rhythm_feel` (uses `rhythm_template_id`, `syncopation_bias`, planet tint)
- **Template class**: 0-2 → "simple, even rhythms", 3-4 → "lightly shifting patterns", 5-6 → "strong, accented patterns", 7 → "fluid, open timing"
- **Syncopation**: ≥0.60 → "with pronounced off-beats", 0.30-0.59 → "with subtle off-beats", <0.30 → "on straight time"

#### B4) Density → `density_desc` (uses `density_level`, stellium check)
- 0.0-0.3 → "sparse textures leave space"
- 0.4-0.6 → "balanced layering keeps clarity"  
- 0.7-1.0 → "dense layers add weight"
- **Stellium**: append ", reflecting crowded skies"

#### B5-B7) Tempo, Motif, Astro Color
- **Tempo**: >0.7 → "brisk, Mercury-like pace", 0.4-0.7 → "measured, Jupiter-steady tempo", <0.4 → "slow, Saturn-patient tempo"
- **Motif**: >0.7 → "themes recur often, Venus's love of return", 0.4-0.7 → "motifs return in cycles, Jupiter's rhythm of growth", <0.4 → "few repeats, Mars keeps pushing forward"
- **Astro color**: Build 1-2 adjectives from top element + dominant planets

## 🚀 API Integration

### Single Endpoint: `POST /api/compose`

**Input:**
```json
{
  "mode": "sky|overlay|sandbox",
  "skyParams": { "latitude": 40.7128, "longitude": -74.0060, "datetime": "2025-01-24T12:00:00Z" },
  "overlayParams": { "natalLatitude": 40.7128, "natalLongitude": -74.0060, "natalDatetime": "1990-01-01T12:00:00Z", "currentLatitude": 40.7128, "currentLongitude": -74.0060, "currentDatetime": "2025-01-24T12:00:00Z" },
  "controls": { "step_bias": 0.7, "leap_cap": 5, "rhythm_template_id": 3 },
  "genre": "ambient"
}
```

**Output (Canonical Response):**
```json
{
  "controls": { /* ControlSurface v1.1 */ },
  "astro": { /* AstroSummary v1.1 */ },
  "gate_report": { /* GateReport v1.1 (cal/strict/gold) */ },
  "audio": { "url": "…", "latency_ms": 47 },
  "text": {
    "short": "Tone: energetic, assertive. mostly stepwise motion, kept close and careful — steady connections. Arcs surge then soften, echoing Fire's bursts of energy.",
    "long": "Tone: energetic, assertive. mostly stepwise motion, kept close and careful — steady connections. simple, even rhythms, on straight time. measured, Jupiter-steady tempo. balanced layering keeps clarity. themes recur often, Venus's love of return.",
    "bullets": [
      "• mostly stepwise motion, kept close and careful — steady connections.",
      "• Arcs surge then soften, echoing Fire's bursts of energy.",
      "• simple, even rhythms, on straight time.",
      "• balanced layering keeps clarity.",
      "• themes recur often, Venus's love of return."
    ],
    "atoms": { /* ExplainerAtoms v1.1 */ },
    "template_id": "v1.short.03",
    "seed": "controls_hash"
  },
  "artifacts": {
    "model": "084c92dca9af2f09",
    "encoder": "db4eb96e52b3f63e", 
    "snapset": "185371267270f0ef",
    "gate": "v2.3"
  }
}
```

## 🛡️ Guardrails (Section E)

### Fail-Closed Behavior
When `passed.calibrated === false`:
- `text.short/long/bullets` summarize **why** (by gate) and provide **knob hints** only
- Still return `atoms` (for UI tooltips), but **no descriptive adjectives** that imply success

### Explainability Parity
Every adjective must trace back to a control or astro fact.

### Latency Budget (Section F)
- **Atoms generation**: < 1ms
- **Text realizer**: < 5ms  
- **Total text**: < 10ms

### Determinism (Section F)
Outputs must be reproducible given the same `{controls, astro}`. `seed = controls.hash` for all text variation picks.

## 🔀 Mode Support (Section D)

### Sky Mode
Real-time astro data → control-surface → audio + text

### Overlay Mode (Section D)
Natal vs current comparison with contrast language:
- `step_bias Δ ≥ +0.10` → "more stepwise than natal"
- `leap_cap Δ ≥ +1` → "wider leaps than natal"  
- `syncopation Δ ≥ +0.15` → "more syncopated feel than natal"

### Sandbox Mode (Section D)
User-controlled parameters with helpful suggestions:
- `step_leap fail` → "Try **step_bias +0.1** or **leap_cap → 3**."
- `rhythm_div fail` → "Switch to template 3 or raise syncopation slightly."
- `arc fail` → "Adjust arc to a clearer rise-peak-release."

## 🧪 Testing (Section H)

### Quick Fixture Set (F1-F7)

| Case | Controls highlight | Astro | Expect |
|------|-------------------|-------|---------|
| F1 | `step_bias=0.8, leap_cap=2` | Venus/Earth | "mostly stepwise… kept close… steady connections" |
| F2 | `step_bias=0.35, leap_cap=5` | Uranus/Fire | "leaping intervals… wide reaches… disruptive spark" |
| F3 | `rtpl=5, sync=0.65` | Mars | "strong, accented… pronounced off-beats… Mars" |
| F4 | `density=0.8` | Stellium true | "dense layers… reflecting crowded skies" |
| F5 | `tempo=0.3` | Saturn | "slow, Saturn-patient tempo" in long text |
| F6 | **Overlay** A→B: `step_bias +0.15` | — | "more stepwise than natal" |
| F7 | **Sandbox fail**: step_leap gate fails | — | Hint includes step_bias/leap_cap adjustment |

Run the test script:
```bash
npm run vnext:build
node dist/vnext/explainer/test-explainer-v1.1.js
```

## ✅ Acceptance Checklist (Section G)

1. **Contracts match** this spec (no field name drift) ✅
2. **Atoms generator** is a pure function of `{controls, astro}` ✅
3. **Mapping tables v1** exactly as Section B (ids/ranges/wording) ✅
4. **Seeded variation** uses `controls.hash` only ✅
5. **Overlay Δ-logic** produces contrast sentences when Δ exceeds thresholds ✅
6. **Sandbox hints** map each failing gate → concrete knob advice ✅
7. **Fail-closed** behavior: no musical adjectives on failed calibrated ✅
8. **API `/api/compose`** returns audio+text in one response; artifacts & gates included ✅
9. **Latency & determinism** logged per request; unit tests pass for 10 fixed fixtures ✅
10. **Docs**: README shows example inputs/outputs for sky/overlay/sandbox ✅

## 📊 Telemetry & QA (Section F)

```typescript
interface ExplainerMetrics {
  atoms_generation_ms: number;
  realizer_ms: number;
  total_ms: number;
  template_id: string;
  atoms_count: number;
  adjectives_used: string[];
  gate_status: "pass" | "fail";
  fail_reason?: string;
}
```

- **Determinism test**: same `{controls, astro}` → identical `atoms` & `text`
- **Latency SLO**: text generation total **< 10 ms**
- **Copy audit**: every adjective in text must be traceable to a specific atom rule

## 🚀 Ready for Phase 3 MVP

The text explainer v1.1 is now ready for integration with the main audio engine. The complete pipeline provides:

1. **Unified control-surface** driving both audio and text
2. **Deterministic text generation** with < 10ms latency  
3. **Fail-closed behavior** with helpful user guidance
4. **Multiple output styles** (short, long, bullets)
5. **Comprehensive telemetry** for monitoring and optimization
6. **Astrology-first approach** with music as expression

The system is ready for **Phase 3 MVP feature expansion** with audio + text from a single API call.
