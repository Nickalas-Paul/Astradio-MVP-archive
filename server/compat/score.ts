// Compatibility Scoring Engine
// Rule-based scoring with ML-ready interface

import type { CompatFacet, SynFeature, ScoreArgs, ScoreResult } from '../../src/core/compat/types';

// Scoring weights
const W = {
  baseSim: 0.50,
  bonuses: 0.40,
  penalties: 0.30,
  cap: 0.15
};

export function scoreCompatibility({ facet, A, B, syn }: ScoreArgs): ScoreResult {
  // 1) base similarity from vectors (cosine in 0..1)
  const sim = cosine01(A.features64, B.features64);

  // 2) facet-specific bonuses/penalties from synastry rules
  let bonus = 0, penalty = 0;
  for (const s of syn) {
    const k = ruleWeight(facet, s);
    if (k >= 0) bonus += k * s.strength;
    else penalty += (-k) * s.strength;
  }

  // 3) combine with diminishing returns + cap
  const raw = (
    W.baseSim * sim +
    W.bonuses * (1 - Math.exp(-2 * bonus)) -     // saturate
    W.penalties * (1 - Math.exp(-2 * penalty))
  );

  // 4) clamp + small uplift if strong base sim
  const score = clamp01(raw + softCap(sim, W.cap));
  const rationale = buildRationale(facet, syn);

  return {
    score,
    rationale,
    breakdown: {
      baseSimilarity: sim,
      bonuses: bonus,
      penalties: penalty,
      finalScore: score
    }
  };
}

// Cosine similarity normalized to 0..1
function cosine01(a: number[], b: number[]): number {
  let dp = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dp += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0.5;
  const c = dp / (Math.sqrt(na) * Math.sqrt(nb));
  return (c + 1) / 2; // to 0..1
}

function softCap(sim: number, cap: number): number {
  return Math.min(cap, sim * 0.1);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Facet-specific weights (rule-based, ML-ready for replacement)
function ruleWeight(facet: CompatFacet, s: SynFeature): number {
  const orbFalloff = Math.max(0, 1 - s.orbDeg / 8); // linear falloff
  const dign = s.dignity === 'domicile' || s.dignity === 'exalt' ? 1.1 :
    s.dignity === 'detriment' || s.dignity === 'fall' ? 0.9 : 1.0;

  const Asoft = (a: number) => a * orbFalloff * dign;

  // Lovers facet
  if (facet === 'lovers') {
    if (isPair(s, 'Venus', 'Mars') && softAspect(s)) return +Asoft(0.35);
    if (isPair(s, 'Sun', 'Moon') && softAspect(s)) return +Asoft(0.30);
    if (isPair(s, 'Venus', 'Sun') && softAspect(s)) return +Asoft(0.25);
    if (isPair(s, 'Mars', 'Moon') && softAspect(s)) return +Asoft(0.20);
    if (hardAspect(s) && isIn(['Saturn', 'Mars'], s.bodies)) return -Asoft(0.25);
    if (hardAspect(s) && isPair(s, 'Venus', 'Saturn')) return -Asoft(0.20);
  }

  // Friends facet
  if (facet === 'friends') {
    if (isPair(s, 'Mercury', 'Jupiter') && softAspect(s)) return +Asoft(0.25);
    if (isPair(s, 'Sun', 'Jupiter') && softAspect(s)) return +Asoft(0.20);
    if (isPair(s, 'Moon', 'Venus') && softAspect(s)) return +Asoft(0.18);
    if (isPair(s, 'Mercury', 'Mercury') && softAspect(s)) return +Asoft(0.15);
    if (hardAspect(s) && isPair(s, 'Moon', 'Mars')) return -Asoft(0.20);
    if (hardAspect(s) && isPair(s, 'Mercury', 'Saturn')) return -Asoft(0.15);
  }

  // Creative facet
  if (facet === 'creative') {
    if (isAny(s, ['Sun', 'Uranus', 'Mercury']) && softAspect(s)) return +Asoft(0.28);
    if (isPair(s, 'Venus', 'Neptune') && softAspect(s)) return +Asoft(0.22);
    if (isPair(s, 'Mercury', 'Uranus') && softAspect(s)) return +Asoft(0.20);
    if (houseOverlay(s, [3, 5, 11])) return +Asoft(0.15);
    if (hardAspect(s) && isPair(s, 'Mercury', 'Saturn')) return -Asoft(0.18);
  }

  // Mentor facet
  if (facet === 'mentor') {
    if (isPair(s, 'Jupiter', 'Sun') && softAspect(s)) return +Asoft(0.25);
    if (isPair(s, 'Saturn', 'Mercury') && softAspect(s)) return +Asoft(0.18);
    if (isPair(s, 'Jupiter', 'Mercury') && softAspect(s)) return +Asoft(0.20);
    if (houseOverlay(s, [9, 10])) return +Asoft(0.12);
    if (hardAspect(s) && isPair(s, 'Saturn', 'Moon')) return -Asoft(0.22);
    if (hardAspect(s) && isPair(s, 'Jupiter', 'Mars')) return -Asoft(0.15);
  }

  // Conflict facet (higher score = more conflict)
  if (facet === 'conflict') {
    if (hardAspect(s) && isAny(s, ['Mars', 'Pluto', 'Saturn'])) return +Asoft(0.30);
    if (isPair(s, 'Mars', 'Mars') && hardAspect(s)) return +Asoft(0.25);
    if (isPair(s, 'Saturn', 'Sun') && hardAspect(s)) return +Asoft(0.22);
    if (isPair(s, 'Pluto', 'Moon') && hardAspect(s)) return +Asoft(0.20);
    if (softAspect(s) && isPair(s, 'Venus', 'Jupiter')) return -Asoft(0.20);
    if (softAspect(s) && isPair(s, 'Sun', 'Jupiter')) return -Asoft(0.15);
  }

  // Overall facet (blended approach)
  if (facet === 'overall') {
    // Weighted combination of all facets
    const loversWeight = isPair(s, 'Venus', 'Mars') || isPair(s, 'Sun', 'Moon') ? 0.25 : 0;
    const friendsWeight = isPair(s, 'Mercury', 'Jupiter') || isPair(s, 'Sun', 'Jupiter') ? 0.20 : 0;
    const creativeWeight = isAny(s, ['Sun', 'Uranus', 'Mercury']) ? 0.20 : 0;
    const mentorWeight = isPair(s, 'Jupiter', 'Sun') || isPair(s, 'Saturn', 'Mercury') ? 0.15 : 0;
    const conflictWeight = hardAspect(s) && isAny(s, ['Mars', 'Pluto', 'Saturn']) ? 0.20 : 0;

    const totalWeight = loversWeight + friendsWeight + creativeWeight + mentorWeight + conflictWeight;
    if (totalWeight > 0) {
      return Asoft(totalWeight * 0.3); // Normalize by total weight
    }
  }

  return 0;
}

// Helper functions
const softAspect = (s: SynFeature): boolean => 
  s.aspect === 'trine' || s.aspect === 'sextile' || s.aspect === 'conj';

const hardAspect = (s: SynFeature): boolean => 
  s.aspect === 'square' || s.aspect === 'opp';

function isPair(s: SynFeature, a: string, b: string): boolean {
  return (s.bodies[0] === a && s.bodies[1] === b) || 
         (s.bodies[0] === b && s.bodies[1] === a);
}

function isAny(s: SynFeature, names: string[]): boolean {
  return names.includes(s.bodies[0]) || names.includes(s.bodies[1]);
}

function isIn(names: string[], bodies: [string, string]): boolean {
  return names.includes(bodies[0]) || names.includes(bodies[1]);
}

function houseOverlay(s: SynFeature, houses: number[]): boolean {
  return !!(s.houseOverlay && houses.includes(s.houseOverlay.house));
}

// Build rationale strings
function buildRationale(facet: CompatFacet, syn: SynFeature[]): string[] {
  const out: string[] = [];
  
  for (const s of syn) {
    if (facet === 'lovers') {
      if (isPair(s, 'Venus', 'Mars') && softAspect(s)) out.push('Venus–Mars harmony');
      if (isPair(s, 'Sun', 'Moon') && softAspect(s)) out.push('Sun–Moon connection');
      if (isPair(s, 'Venus', 'Sun') && softAspect(s)) out.push('Venus–Sun attraction');
      if (isPair(s, 'Mars', 'Moon') && softAspect(s)) out.push('Mars–Moon passion');
    }
    
    if (facet === 'friends') {
      if (isPair(s, 'Mercury', 'Jupiter') && softAspect(s)) out.push('Mercury–Jupiter flow');
      if (isPair(s, 'Sun', 'Jupiter') && softAspect(s)) out.push('Sun–Jupiter warmth');
      if (isPair(s, 'Moon', 'Venus') && softAspect(s)) out.push('Moon–Venus comfort');
      if (isPair(s, 'Mercury', 'Mercury') && softAspect(s)) out.push('Mercury–Mercury sync');
    }
    
    if (facet === 'creative') {
      if (isAny(s, ['Sun', 'Uranus', 'Mercury']) && softAspect(s)) out.push('Sun/Uranus/Mercury spark');
      if (isPair(s, 'Venus', 'Neptune') && softAspect(s)) out.push('Venus–Neptune inspiration');
      if (isPair(s, 'Mercury', 'Uranus') && softAspect(s)) out.push('Mercury–Uranus innovation');
    }
    
    if (facet === 'mentor') {
      if (isPair(s, 'Jupiter', 'Sun') && softAspect(s)) out.push('Jupiter–Sun wisdom');
      if (isPair(s, 'Saturn', 'Mercury') && softAspect(s)) out.push('Saturn–Mercury discipline');
      if (isPair(s, 'Jupiter', 'Mercury') && softAspect(s)) out.push('Jupiter–Mercury teaching');
    }
    
    if (facet === 'conflict') {
      if (hardAspect(s) && isAny(s, ['Mars', 'Pluto', 'Saturn'])) out.push('High-friction aspect pattern');
      if (isPair(s, 'Mars', 'Mars') && hardAspect(s)) out.push('Mars–Mars tension');
      if (isPair(s, 'Saturn', 'Sun') && hardAspect(s)) out.push('Saturn–Sun challenge');
    }
    
    if (facet === 'overall') {
      if (isPair(s, 'Venus', 'Mars') && softAspect(s)) out.push('Venus–Mars harmony');
      if (isPair(s, 'Mercury', 'Jupiter') && softAspect(s)) out.push('Mercury–Jupiter flow');
      if (isAny(s, ['Sun', 'Uranus', 'Mercury']) && softAspect(s)) out.push('Creative spark');
      if (isPair(s, 'Jupiter', 'Sun') && softAspect(s)) out.push('Jupiter–Sun wisdom');
      if (hardAspect(s) && isAny(s, ['Mars', 'Pluto', 'Saturn'])) out.push('Challenging aspects');
    }
  }
  
  return [...new Set(out)].slice(0, 4); // Remove duplicates, limit to 4
}

// Export utility functions for testing
export {
  cosine01,
  softAspect,
  hardAspect,
  isPair,
  isAny,
  isIn,
  houseOverlay,
  buildRationale
};
