// vnext/api/astro-debug.ts
// Astro debug API: ephemeris → features → guidance → planner preview

import type { EphemerisSnapshot, FeatureVec } from "../contracts";
import { encodeFeatures } from "../feature-encode";
import { studentVector } from "../ml/student";
import { planFromVector } from "../planner/narrative";

export interface AstroGuidance {
  tempoBias: number;    // [-1, +1] based on fire+air vs earth+water
  arcBias: number;      // [-1, +1] based on tension (squares+oppositions)
  densityBias: number;  // [-1, +1] based on modality ratios
  motifIdx: number;     // [0-7] based on sun sign
  cadenceIdx: number;   // [0-3] based on moon phase
}

export interface AstroDebugResponse {
  chartContext: EphemerisSnapshot;
  featureVec: number[];
  astroGuidance: AstroGuidance;
  studentV6: number[];
  planPreviewMeta: {
    bpm: number;
    arcLift: number;
    motifIdx: number;
    cadenceIdx: number;
    density: number;
  };
}

export function computeAstroGuidance(featureVec: FeatureVec, chartContext: EphemerisSnapshot): AstroGuidance {
  // Extract element proportions from feature vector (indices 27-30)
  const fire = featureVec[27] || 0;
  const earth = featureVec[28] || 0;
  const air = featureVec[29] || 0;
  const water = featureVec[30] || 0;
  
  // Tempo bias: fire+air vs earth+water
  const dynamicElements = fire + air;
  const stableElements = earth + water;
  const tempoBias = dynamicElements > stableElements ? 
    (dynamicElements - stableElements) / 2 : 
    -(stableElements - dynamicElements) / 2;
  
  // Arc bias: tension from squares+oppositions (index 32)
  const tension = featureVec[32] || 0;
  const arcBias = Math.max(-1, Math.min(1, (tension - 0.5) * 2));
  
  // Density bias: cluster density (index 33) and modality
  const clusterDensity = featureVec[33] || 0;
  const densityBias = Math.max(-1, Math.min(1, (clusterDensity - 0.5) * 2));
  
  // Motif index: based on sun sign (0-11)
  const sunLon = chartContext.planets.find(p => p.name === 'sun')?.lon || 0;
  const motifIdx = Math.floor(sunLon / 30) % 8; // Map to 0-7 motif range
  
  // Cadence index: based on moon phase
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

export async function astroDebugHandler(req: any, res: any) {
  try {
    const { chartContext } = req.body;
    
    if (!chartContext) {
      return res.status(400).json({ error: "Missing chartContext in request body" });
    }
    
    // Validate chartContext structure
    if (!chartContext.planets || !Array.isArray(chartContext.planets)) {
      return res.status(400).json({ error: "Invalid chartContext: missing or invalid planets array" });
    }
    
    // Convert to EphemerisSnapshot format if needed
    const snapshot: EphemerisSnapshot = {
      ts: chartContext.ts || chartContext.date || new Date().toISOString(),
      tz: chartContext.tz || chartContext.timezone || "UTC",
      lat: chartContext.lat || chartContext.latitude || 0,
      lon: chartContext.lon || chartContext.longitude || 0,
      houseSystem: chartContext.houseSystem || "placidus",
      planets: chartContext.planets.map((p: any) => ({
        name: p.name,
        lon: p.lon || p.longitude || 0
      })),
      houses: chartContext.houses || Array.from({length: 12}, (_, i) => i * 30) as [number, number, number, number, number, number, number, number, number, number, number, number],
      aspects: chartContext.aspects || [],
      moonPhase: chartContext.moonPhase || 0.5,
      dominantElements: chartContext.dominantElements || {
        fire: 0.25, earth: 0.25, air: 0.25, water: 0.25
      }
    };
    
    // Encode features
    const featureVec = encodeFeatures(snapshot);
    
    // Compute astro guidance
    const astroGuidance = computeAstroGuidance(featureVec, snapshot);
    
    // Get student model output
    const studentV6 = await studentVector(featureVec);
    
    // Generate plan preview metadata
    const [vTempo, vBright, vDense, vArc, vMotif, vCad] = studentV6;
    const bpm = Math.round(70 + vTempo * 70); // 70-140 BPM
    const arcLift = 3 + vArc * 7; // 3-10 semitone lift
    
    const planPreviewMeta = {
      bpm,
      arcLift: Math.round(arcLift),
      motifIdx: Math.floor(vMotif * 8),
      cadenceIdx: Math.floor(vCad * 4),
      density: vDense
    };
    
    const response: AstroDebugResponse = {
      chartContext: snapshot,
      featureVec: Array.from(featureVec),
      astroGuidance,
      studentV6,
      planPreviewMeta
    };
    
    res.json(response);
    
  } catch (error: any) {
    console.error("Error in astro debug handler:", error);
    res.status(500).json({ 
      error: "Failed to process astro debug request", 
      details: error.message 
    });
  }
}
