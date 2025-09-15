// vnext/ml/student.ts
// Student model for ML-primary generation (no rules fallback)

import type { FeatureVec, Plan, EventToken } from "../contracts";

export async function generateWithStudent(feat: FeatureVec): Promise<Plan> {
  // Placeholder: integrate TF.js model later
  // Return ML-shaped plan deterministically for now
  const bpm = Math.round(80 + feat[0] * 60);
  const durationSec = +(process.env.VNEXT_DURATION_SEC || 60);
  const key = 'A minor';

  const events: EventToken[] = [];
  const step = durationSec / 128;
  
  for (let i = 0; i < 128; i++) {
    const t0 = i * step;
    const t1 = t0 + step * 0.9;
    
    // Melody events
    events.push({
      t0,
      t1,
      pitch: 60 + (i % 7),
      velocity: 0.6,
      channel: i % 4 === 0 ? 'harmony' : 'melody'
    });
    
    // Bass events
    if (i % 2 === 0) {
      events.push({
        t0,
        t1,
        pitch: 36 + (i % 5),
        velocity: 0.55,
        channel: 'bass'
      });
    }
    
    // Rhythm events
    if (i % 4 === 0) {
      events.push({
        t0,
        t1,
        pitch: 42,
        velocity: 0.5,
        channel: 'rhythm'
      });
    }
  }

  return {
    id: `plan_${Date.now()}`,
    featureHash: `${feat[0]}:${feat[1]}`,
    durationSec,
    bpm,
    key,
    events
  };
}
