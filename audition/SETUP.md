# Teacher Audition Setup Guide

## Prerequisites

1. **Real Training Scaler Stats** - You need the actual `x_mean`, `x_std`, `y_mean`, `y_std` arrays from your training pipeline
2. **Node.js** - For TypeScript compilation
3. **Existing Systems** - `window.mlManager` and `window.audioEngine` must be available

## Quick Setup (5 minutes)

### 1. Install Dependencies
```bash
cd audition
npm install
```

### 2. Build the System
```bash
npm run build
```

### 3. Integrate with HTML
```bash
node integrate-html.js
```

### 4. Load Real Scaler (REQUIRED)
Before running the audition, load your real training scaler:

```javascript
// In your app initialization or before calling audition
window.ModelArtifacts = {
  teacherScaler: {
    x_mean: [...], // 46 features from your training
    x_std: [...],  // 46 features from your training  
    y_mean: [...], // 6 outputs from your training
    y_std: [...],  // 6 outputs from your training
    version: 'v1'
  }
};
```

### 5. Update Audition Button
Replace your existing audition button handler:

```javascript
document.getElementById('audition-button')?.addEventListener('click', async () => {
  try {
    console.log('[UI] Starting Teacher Audition...');
    
    // Generate 50 real Swiss-Ephemeris charts (your existing logic)
    const charts = await generateTestCharts(50);
    
    // Run new audition system
    const result = await window.runTeacherAudition(charts);
    
    // Display results
    displayAuditionResults(result);
    
  } catch (error) {
    console.error('[UI] Audition failed:', error.message);
    displayError(error.message);
  }
});
```

## Verification

### 1. Check Console Logs
You should see:
```
[FeatureEncoder] Initialized with FEATURE_LEN=46
[FeatureEncoder] Feature order: ['sun_position', 'moon_position', ...] ... ['aspect_tension', 'harmonic_balance']
[Teacher] Scaler verified: x_mean[0..2]=[...], x_std[0..2]=[...]
```

### 2. Run Smoke Test
1. Click audition button
2. Check for feature diversity logs: `[Audition] Feature diversity: X/46 features with variance > 0.01`
3. Check for model variance: `[Audition] Model output diversity: X/6 dimensions with variance > 0.05`
4. Verify single audio render for winner

## Troubleshooting

### "REAL TRAINING SCALER REQUIRED"
- **Cause**: No scaler loaded or placeholder detected
- **Fix**: Load real training stats into `window.ModelArtifacts.teacherScaler`

### "Feature order mismatch"
- **Cause**: Your training used different feature order
- **Fix**: Update `FEATURE_ORDER` in `feature-encoder.ts` to match your training

### "Model output variance insufficient"
- **Cause**: Scaler stats don't match training or model issue
- **Fix**: Verify scaler stats are from same training run as model

### "No winner: No compositions passed quality gates"
- **Cause**: Quality gates too strict or composition generation issue
- **Fix**: Check gate thresholds in `quality-gates.ts` or improve composition generation

## File Structure After Setup

```
public/
├── audition/           # Compiled JS files
│   ├── contracts.js
│   ├── scaler.js
│   ├── feature-encoder.js
│   ├── teacher.js
│   ├── generator.js
│   ├── quality-gates.js
│   ├── audition-runner.js
│   ├── render-client.js
│   ├── telemetry.js
│   └── integration.js
└── index.html          # Updated with script imports
```

## Rollback Plan

If issues arise:
1. Remove the audition script imports from `index.html`
2. Restore original audition button handler
3. Old system continues working

## Next Steps

1. **Provide real scaler stats** - This is the only blocker
2. **Confirm feature order** - Verify 46 features match your training
3. **Test integration** - Run smoke test with real data
4. **Remove old files** - Once verified, remove old audition code
