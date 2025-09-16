# Teacher Audition System

A clean, minimal implementation of Astradio's Teacher Audition system for ML-primary music generation.

## Architecture

- **ML Teacher**: Predicts 6-D control vector from Swiss-Ephemeris chart features
- **Rules Engine**: Generates compositions using the vector as conditioning
- **Quality Gates**: Evaluates composition quality with strict thresholds
- **Single Output**: Renders audio only for the best passing composition

## Usage

### Basic Usage

```typescript
import { initAuditionRunner } from './audition-runner';
import { ChartContext } from './contracts';

const charts: ChartContext[] = [
  {
    planets: { sun: 0, moon: 30, mercury: 60, venus: 90, mars: 120, jupiter: 150, saturn: 180, uranus: 210, neptune: 240, pluto: 270 },
    houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
    aspects: [],
    moonPhase: 0.5,
    dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 }
  }
  // ... more charts
];

const result = await initAuditionRunner(charts);
console.log(`Audition complete: ${result.passed}/${result.total} passed`);
```

### Required Setup

1. **Load Real Training Scaler**:
   ```javascript
   window.ModelArtifacts = {
     teacherScaler: {
       x_mean: [...], // 46 features
       x_std: [...],  // 46 features
       y_mean: [...], // 6 outputs
       y_std: [...],  // 6 outputs
       version: 'v1'
     }
   };
   ```

2. **Ensure ML Manager Available**:
   ```javascript
   window.mlManager = { /* existing ML manager */ };
   ```

3. **Ensure AudioEngine Available**:
   ```javascript
   window.audioEngine = { /* existing audio engine */ };
   ```

## Quality Gates

1. **MelodicActivityGate**: `melodic_activity ≥ 0.10`
2. **ArcShapeGate**: Melodic arc score `≥ 0.30`
3. **BasicSanityGate**: Min 60 notes, valid timing

## Telemetry

The system provides structured logging:

- `[Teacher] Scaler verified: x_mean[0..2]=[...], x_std[0..2]=[...]`
- `[Audition] Feature diversity: X/46 features with variance > 0.01`
- `[Audition] Model output diversity: X/6 dimensions with variance > 0.05`
- `[Audition] Gate results: X/Y passed`
- `[Audition] Winner selected: Chart X, Score: Y`

## Error Handling

### Scaler Missing/Placeholder
```
[Teacher] REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.
```
**Solution**: Load real training statistics into `window.ModelArtifacts.teacherScaler`

### Low Variance
```
[Audition] Model output variance insufficient after real scaling: failing audition.
```
**Solution**: Check if scaler stats are correct, or investigate model/data issues

### No Passing Compositions
```
[Audition] No winner: No compositions passed quality gates
```
**Solution**: Adjust quality gate thresholds or improve composition generation

## Testing

Run unit tests:
```bash
npm test
```

Run integration tests:
```bash
npm run test:integration
```

## File Structure

```
audition/
├── contracts.ts           # Type definitions
├── scaler.ts             # Scaler loading/validation
├── feature-encoder.ts    # Chart → features
├── teacher.ts            # ML vector prediction
├── generator.ts          # Vector → composition
├── quality-gates.ts      # Quality evaluation
├── audition-runner.ts    # Main orchestrator
├── render-client.ts      # Audio rendering
├── telemetry.ts          # Logging/diagnostics
└── tests/
    ├── unit/             # Unit tests
    └── integration/      # Integration tests
```

## Integration Points

- **UI**: Call `initAuditionRunner(charts)` from existing audition button
- **ML**: Uses existing `window.mlManager` for vector prediction
- **Audio**: Uses existing `window.audioEngine` for composition generation
- **Render**: Calls existing `/api/render` endpoint

## Success Criteria

- Pre-clamp variance ≥ 0.05 on ≥ 4/6 vector dimensions
- ≥ 1 composition passes all quality gates
- Exactly one audio file rendered (for winner)
- Clear error messages for all failure modes
