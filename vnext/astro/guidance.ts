// vnext/astro/guidance.ts
// Pure function to compute astrological guidance from features and chart context

import type { EphemerisSnapshot, FeatureVec } from "../contracts";

export interface AstroGuidance {
  tempoBias: number;    // [-1, +1] based on fire+air vs earth+water
  arcBias: number;      // [-1, +1] based on tension (squares+oppositions)
  densityBias: number;  // [-1, +1] based on modality ratios
  motifIdx: number;     // [0-7] based on sun sign
  cadenceIdx: number;   // [0-3] based on moon phase
}

/**
 * Compute astrological guidance from feature vector and chart context
 * Pure function with no side effects
 */
export function guidanceFromFeatures(featureVec: FeatureVec, chartContext: EphemerisSnapshot): AstroGuidance {
  // Extract element proportions from feature vector (indices 27-30)
  const fire = featureVec[27] || 0;
  const earth = featureVec[28] || 0;
  const air = featureVec[29] || 0;
  const water = featureVec[30] || 0;
  
  // Tempo bias: fire+air vs earth+water proportion
  const dynamicElements = fire + air;
  const stableElements = earth + water;
  const tempoBias = dynamicElements > stableElements ? 
    (dynamicElements - stableElements) / 2 : 
    -(stableElements - dynamicElements) / 2;
  
  // Arc bias: tension from squares+oppositions (index 32)
  const tension = featureVec[32] || 0;
  const arcBias = Math.max(-1, Math.min(1, (tension - 0.5) * 2));
  
  // Density bias: cluster density (index 33)
  const clusterDensity = featureVec[33] || 0;
  const densityBias = Math.max(-1, Math.min(1, (clusterDensity - 0.5) * 2));
  
  // Motif index: based on sun sign (0-11) mapped to 0-7
  const sunLon = chartContext.planets.find(p => p.name === 'sun')?.lon || 0;
  const motifIdx = Math.floor(sunLon / 30) % 8; // Map to 0-7 motif range
  
  // Cadence index: based on moon phase (<0.5 vs >=0.5)
  const moonPhase = featureVec[31] || 0;
  const cadenceIdx = moonPhase < 0.5 ? 0 : 1; // Simple binary for now
  
  return {
    tempoBias: Math.max(-1, Math.min(1, tempoBias)),
    arcBias: Math.max(-1, Math.min(1, arcBias)),
    densityBias: Math.max(-1, Math.min(1, densityBias)),
    motifIdx,
    cadenceIdx
  };
}

/**
 * Apply astrological guidance biases to narrative planner parameters
 */
export function applyGuidanceBias(baseVector: [number, number, number, number, number, number], guidance: AstroGuidance): [number, number, number, number, number, number] {
  const [vTempo, vBright, vDense, vArc, vMotif, vCad] = baseVector;
  
  // Apply tempo bias (10% influence)
  const biasedTempo = Math.max(0, Math.min(1, vTempo * (1 + 0.1 * guidance.tempoBias)));
  
  // Apply arc bias (30% influence on arc lift)
  const biasedArc = Math.max(0, Math.min(1, vArc * (1 + 0.3 * guidance.arcBias)));
  
  // Apply density bias (20% influence)
  const biasedDensity = Math.max(0, Math.min(1, vDense + 0.2 * guidance.densityBias));
  
  // Override motif/cadence when guidance provides specific indices
  const biasedMotif = guidance.motifIdx !== undefined ? guidance.motifIdx / 7 : vMotif;
  const biasedCadence = guidance.cadenceIdx !== undefined ? guidance.cadenceIdx / 3 : vCad;
  
  return [biasedTempo, vBright, biasedDensity, biasedArc, biasedMotif, biasedCadence];
}
