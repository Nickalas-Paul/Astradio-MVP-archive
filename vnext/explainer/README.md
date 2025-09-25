# Phase 3 - Text Explainer Integration

## 🎯 Overview

The Text Explainer extends the **control-surface distillation pipeline** to generate dynamic text explanations alongside audio synthesis. Both audio and text are generated from the same `{controls, astro}` payload, ensuring perfect alignment and deterministic output.

## 🏗️ Architecture

```
Swiss Ephemeris → Features (64-dim)  
               → Student v2.3 → CONTROL_SURFACE  
                                 ├─► Audio Planner/Synth  
                                 └─► Text Explainer
```

## 📁 File Structure

```
vnext/explainer/
├── contracts.ts           # TypeScript interfaces and types
├── mapping-tables-v1.json # Deterministic atom→phrase mappings
├── atoms-generator.ts     # Generates semantic facts from controls
├── text-realizer.ts       # Converts atoms to formatted text
├── text-explainer.ts      # Main orchestrator
├── test-explainer.ts      # Validation test script
└── README.md             # This documentation
```

## 🔧 Core Components

### 1. Explainer Atoms (Semantic Facts)

Deterministic facts generated directly from `{controls, astro}`:

- `arc_desc`: "gentle rise → peak → release" (from arc_shape)
- `movement`: "mostly stepwise, capped leaps" (from step_bias, leap_cap)
- `rhythm_feel`: "light syncopation; template 4" (from rhythm_template_id, syncopation_bias)
- `density_desc`: "moderate texture" (from density_level)
- `motif_desc`: "recurring idea every ~2 bars" (from motif_rate)
- `astro_color`: "Air + Venus influence; social, light" (from element/aspect mix)

### 2. Surface Realizer (Templated Text)

- **Template library** with slots for atoms
- **Three output styles**: `short`, `long`, `bullets`
- **Synonym micro-variation** seeded by `controls.hash` for deterministic variation

### 3. Mapping Tables v1

Comprehensive mapping from control values to human-readable phrases:

- **Arc descriptions**: gentle_rise, moderate_rise, strong_rise, etc.
- **Movement descriptions**: stepwise_heavy, balanced, leap_moderate, etc.
- **Rhythm feelings**: steady_eighth, swung_eighth, syncopated, etc.
- **Density descriptions**: sparse, light, moderate, rich, dense
- **Motif descriptions**: frequent, moderate, occasional, sparse
- **Astro colors**: fire_dominant, earth_secondary, balanced, etc.

## 🚀 API Integration

### Single Endpoint: `POST /api/compose`

**Input:**
```json
{
  "mode": "sky|overlay|sandbox",
  "skyParams": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "datetime": "2025-01-24T12:00:00Z"
  },
  "overlayParams": {
    "natalLatitude": 40.7128,
    "natalLongitude": -74.0060,
    "natalDatetime": "1990-01-01T12:00:00Z",
    "currentLatitude": 40.7128,
    "currentLongitude": -74.0060,
    "currentDatetime": "2025-01-24T12:00:00Z"
  },
  "controls": {
    "step_bias": 0.7,
    "leap_cap": 5,
    "rhythm_template_id": 3
  },
  "genre": "ambient"
}
```

**Output:**
```json
{
  "controls": {...},
  "astro": {...},
  "gate_report": {...},
  "audio": {
    "url": "/api/audio/abc123.mp3",
    "latency_ms": 47
  },
  "text": {
    "short": "Light, airy phrasing with mainly stepwise motion and gentle rise–fall arcs. Subtle syncopation hints at sociability (Air/Venus), while recurring motifs keep it cohesive.",
    "long": "The musical expression unfolds through mainly stepwise motion with gentle rise–fall arcs, creating a flowing journey for the listener. Swung eighth-note feel provides the rhythmic foundation, while Air influence infuses the piece with moderate texture. Recurring ideas every ~2 bars ensure thematic coherence throughout the composition.",
    "bullets": [
      "• mainly stepwise motion with gentle rise–fall arcs creates the melodic foundation",
      "• gentle rise–fall arcs shapes the overall contour",
      "• swung eighth-note feel establishes rhythmic character",
      "• Air influence adds moderate texture",
      "• recurring ideas every ~2 bars provide thematic unity"
    ],
    "atoms": {
      "arc_desc": "gentle rise–fall arcs",
      "movement": "mainly stepwise motion with capped leaps",
      "rhythm_feel": "swung eighth-note feel with subtle syncopation",
      "density_desc": "moderate texture",
      "motif_desc": "recurring ideas every ~2 bars",
      "astro_color": "Air influence with gentle tension"
    },
    "template_id": "template_2",
    "seed": "abc123"
  },
  "artifacts": {
    "model": "084c92dca9af2f09",
    "encoder": "db4eb96e52b3f63e",
    "snapset": "185371267270f0ef",
    "gate": "v2.3-final",
    "timestamp": "2025-01-24T12:00:00Z"
  }
}
```

## 🛡️ Guardrails

### Fail-Closed Behavior
When gates fail, return **hints** instead of false descriptions:

```json
{
  "text": {
    "short": "Too many leaps for step-leap gate. Try increasing step_bias or lowering leap_cap."
  }
}
```

### Explainability Parity
Every adjective must trace back to a control or astro fact.

### Latency Budget
- **Atoms generation**: < 1ms
- **Text realizer**: < 5ms
- **Total text**: < 10ms

### Determinism
Outputs must be reproducible given the same `{controls, astro}`.

## 🔀 Mode Support

### Sky Mode
Real-time astro data → control-surface → audio + text

### Overlay Mode
Natal vs current comparison with contrast language:
> "Compared to your natal, today adds **more syncopation** and **wider leaps**, shifting the feel from reflective to energetic."

### Sandbox Mode
User-controlled parameters with helpful suggestions:
> "Too many leaps for strict gate. Try **step_bias +0.1** or **leap_cap → 3**."

## 📊 Telemetry & Metrics

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

## 🧪 Testing

Run the test script to validate the complete pipeline:

```bash
npm run vnext:build
node dist/vnext/explainer/test-explainer.js
```

Expected output:
```
🧪 Testing Text Explainer v1.0
================================

1️⃣ Testing with PASSING gates:
--------------------------------
📝 Generated Text:
Short: Light, airy phrasing with mainly stepwise motion and gentle rise–fall arcs...
Long: The musical expression unfolds through mainly stepwise motion...
Bullets: [
  "• mainly stepwise motion creates the melodic foundation",
  "• gentle rise–fall arcs shapes the overall contour",
  ...
]

⏱️ Metrics:
Atoms generation: 0.45ms
Text realizer: 2.31ms
Total: 2.76ms
Gate status: pass

✅ All tests completed successfully!
```

## 📅 Implementation Timeline

- **D1**: Contracts & mapping tables ✅
- **D2**: Atoms generator ✅
- **D3**: Text realizer ✅
- **D4**: API integration ✅
- **D5**: Testing & validation ✅
- **D6**: Dogfood testing
- **D7**: Production deployment

## 🎯 Success Criteria

- ✅ **Latency**: < 10ms total text generation
- ✅ **Determinism**: Reproducible outputs
- ✅ **Fail-closed**: Helpful hints on gate failures
- ✅ **Explainability**: All adjectives trace to controls
- ✅ **Integration**: Single API endpoint for audio + text
- ✅ **Mode support**: Sky, overlay, sandbox modes

## 🚀 Ready for Phase 3 MVP

The text explainer is now ready for integration with the main audio engine. The complete pipeline provides:

1. **Unified control-surface** driving both audio and text
2. **Deterministic text generation** with < 10ms latency
3. **Fail-closed behavior** with helpful user guidance
4. **Multiple output styles** (short, long, bullets)
5. **Comprehensive telemetry** for monitoring and optimization

The system is ready for **Phase 3 MVP feature expansion** with audio + text from a single API call.
