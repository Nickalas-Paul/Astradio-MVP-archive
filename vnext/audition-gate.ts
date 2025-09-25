// vnext/audition-gate.ts
// Audition gate for shape/timing validation (no music generation)

import type { Plan, AuditionResult } from "./contracts";
import { scoreMelody, scoreHarmony, scoreRhythm } from "./critics";

export function audition(plan: Plan, cfg = {
  minEvents: +(process.env.VNEXT_MIN_EVENTS || 120),
  duration: +(process.env.VNEXT_DURATION_SEC || 60),
  requireChannels: new Set(['melody', 'harmony'])
}): AuditionResult {
  const issues: string[] = [];
  const repairs: string[] = [];
  const ev = plan.events.slice().sort((a, b) => a.t0 - b.t0);

  // Check minimum events
  if (ev.length < cfg.minEvents) {
    issues.push(`events<${cfg.minEvents}`);
  }

  // Check required channels
  const chans = new Set(ev.map(e => e.channel));
  for (const c of cfg.requireChannels) {
    if (!chans.has(c as any)) {
      issues.push(`missing:${c}`);
    }
  }

  // Check for non-finite values
  const bad = ev.find(e => ![e.t0, e.t1, e.pitch, e.velocity].every(Number.isFinite));
  if (bad) {
    issues.push('non-finite-values');
  }

  // Single timewarp to target duration
  const maxEnd = Math.max(0, ...ev.map(e => e.t1));
  if (Math.abs(maxEnd - cfg.duration) > 1.0) {
    const s = cfg.duration / (maxEnd || 1);
    for (const e of ev) {
      e.t0 *= s;
      e.t1 *= s;
    }
    repairs.push(`timewarp:${s.toFixed(5)}`);
  }

  // Group-aware overlap trim (allow harmony overlap, trim others)
  for (let i = 0; i < ev.length - 1; i++) {
    const A = ev[i];
    const B = ev[i + 1];
    const overlap = Math.min(A.t1, B.t1) - Math.max(A.t0, B.t0);
    const ok = A.channel === 'harmony' || B.channel === 'harmony' || (A.group && A.group === B.group);
    if (overlap > 0 && !ok) {
      B.t0 = Math.max(B.t0, A.t1);
      repairs.push(`trim:${i + 1}`);
    }
  }

  const passed = issues.length === 0;
  
  // Add rule-based quality scoring
  const ruleQuality = ruleQualityPass(plan);
  
  return {
    passed: passed && ruleQuality.ok,
    score: passed ? Math.min(100, ruleQuality.score * 100) : Math.max(0, 100 - issues.length * 10),
    issues: [...issues, ...(ruleQuality.ok ? [] : ['rule-quality-failed'])],
    repairs,
    ruleQuality: ruleQuality
  };
}

/**
 * Rule-based quality pass using critics
 */
export function ruleQualityPass(plan: Plan): { ok: boolean; score: number; breakdown: any } {
const THRESH = {
  arc: 0.40, motif: 0.35, contour: 0.35, stepLeap: 0.35, range: 0.5,
  harmony: 0.4, rhythm: 0.4
};

  const m = scoreMelody(plan);
  const h = scoreHarmony(plan);
  const r = scoreRhythm(plan);
  const ok =
    m.arc >= THRESH.arc &&
    m.motif_recurrence >= THRESH.motif &&
    m.contour_entropy >= THRESH.contour &&
    m.step_leap_ratio >= THRESH.stepLeap &&
    m.range_ok >= THRESH.range &&
    h.progression_legality >= THRESH.harmony &&
    r.syncopation >= THRESH.rhythm;

  // Apply gaming penalty to melodic score
  const melodicScore = (m.arc + m.motif_recurrence + m.contour_entropy + m.step_leap_ratio + m.range_ok) / 5;
  const penalizedMelodicScore = Math.max(0, melodicScore - m.gaming_penalty);
  
  const score = (penalizedMelodicScore + h.progression_legality + r.syncopation) / 3;

  return { ok, score, breakdown: { melody: m, harmony: h, rhythm: r } };
}

// Call this AFTER structural checks pass:
export function applyRuleQualityGate(plan: Plan, issues: string[]) {
  const q = ruleQualityPass(plan);
  (plan as any).__quality = q; // attach for logging/response
  if (!q.ok) {
    issues.push(`Rule quality below threshold (score=${q.score.toFixed(2)})`);
  }
}
