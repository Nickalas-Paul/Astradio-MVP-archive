# Integration Diff for Existing UI

## Files to Add

Add these new files to the project:
```
audition/
├── contracts.ts
├── feature-encoder.ts
├── scaler.ts
├── teacher.ts
├── generator.ts
├── quality-gates.ts
├── audition-runner.ts
├── render-client.ts
├── telemetry.ts
├── integration.ts
├── tests/
│   ├── unit/
│   │   ├── scaler.test.ts
│   │   ├── feature-encoder.test.ts
│   │   └── quality-gates.test.ts
│   └── integration/
│       └── audition.test.ts
└── README.md
```

## Files to Modify

### 1. public/index.html

Add script imports for the new audition system:

```html
<!-- Add after existing script imports -->
<script src="audition/contracts.js"></script>
<script src="audition/scaler.js"></script>
<script src="audition/feature-encoder.js"></script>
<script src="audition/teacher.js"></script>
<script src="audition/generator.js"></script>
<script src="audition/quality-gates.js"></script>
<script src="audition/audition-runner.js"></script>
<script src="audition/render-client.js"></script>
<script src="audition/telemetry.js"></script>
<script src="audition/integration.js"></script>
```

### 2. Update Audition Button Handler

Replace the existing audition button click handler:

```javascript
// Replace existing audition button handler
document.getElementById('audition-button')?.addEventListener('click', async () => {
  try {
    console.log('[UI] Starting Teacher Audition...');
    
    // Generate 50 real Swiss-Ephemeris charts (existing logic)
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

## Files to Remove (After New System is Verified)

Once the new audition system is working correctly, remove these files:

```
public/vector-framework.js          # VectorTeacher class
public/vector-audition-runner.js    # VectorAuditionRunner class  
public/melodic-arc-analyzer.js      # MelodicArcQualityGate class
```

## Required Setup

### 1. Load Real Training Scaler

Before running the audition, ensure the real training scaler is loaded:

```javascript
// Load real training statistics
window.ModelArtifacts = {
  teacherScaler: {
    x_mean: [...], // 46 features from training
    x_std: [...],  // 46 features from training
    y_mean: [...], // 6 outputs from training
    y_std: [...],  // 6 outputs from training
    version: 'v1'
  }
};
```

### 2. Ensure Dependencies

Make sure these existing systems are available:

```javascript
// ML Manager (existing)
window.mlManager = { /* existing implementation */ };

// Audio Engine (existing)
window.audioEngine = { /* existing implementation */ };
```

## Testing the Integration

1. **Load the new scripts** in `index.html`
2. **Set up the real scaler** in `window.ModelArtifacts.teacherScaler`
3. **Click the audition button** to run the new system
4. **Check console logs** for telemetry and results
5. **Verify audio rendering** works for passing compositions

## Expected Behavior

### Success Case
- `[Teacher] Scaler verified: x_mean[0..2]=[...], x_std[0..2]=[...]`
- `[Audition] Feature diversity: X/46 features with variance > 0.01`
- `[Audition] Model output diversity: X/6 dimensions with variance > 0.05`
- `[Audition] Gate results: X/Y passed`
- `[Audition] Winner selected: Chart X, Score: Y`
- `[Audition] Audio rendered: [URL]`

### Failure Cases
- **No scaler**: `[Teacher] REAL TRAINING SCALER REQUIRED: missing/placeholder. Aborting audition.`
- **Low variance**: `[Audition] Model output variance insufficient after real scaling: failing audition.`
- **No passes**: `[Audition] No winner: No compositions passed quality gates`

## Rollback Plan

If issues arise, simply:
1. Remove the new script imports from `index.html`
2. Restore the original audition button handler
3. The old system will continue working as before
