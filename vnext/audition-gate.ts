// vnext/audition-gate.ts
// Audition gate for shape/timing validation (no music generation)

import type { Plan, AuditionResult } from "./contracts";

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
    if (!chans.has(c)) {
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
  return {
    passed,
    score: passed ? 100 : Math.max(0, 100 - issues.length * 10),
    issues,
    repairs
  };
}
