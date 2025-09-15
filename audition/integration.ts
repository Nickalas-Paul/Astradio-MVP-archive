// integration.ts - Integration point for existing UI

import { initAuditionRunner } from './audition-runner';
import { ChartContext } from './contracts';

// Global function for existing UI to call
(window as any).initAuditionRunner = initAuditionRunner;

// Helper function to convert existing chart format to ChartContext
export function convertToChartContext(existingChart: any): ChartContext {
  return {
    planets: {
      sun: existingChart.positions?.sun || 0,
      moon: existingChart.positions?.moon || 0,
      mercury: existingChart.positions?.mercury || 0,
      venus: existingChart.positions?.venus || 0,
      mars: existingChart.positions?.mars || 0,
      jupiter: existingChart.positions?.jupiter || 0,
      saturn: existingChart.positions?.saturn || 0,
      uranus: existingChart.positions?.uranus || 0,
      neptune: existingChart.positions?.neptune || 0,
      pluto: existingChart.positions?.pluto || 0
    },
    houses: existingChart.cusps || existingChart.houses || Array(12).fill(0),
    aspects: existingChart.aspects || [],
    moonPhase: existingChart.moonPhase || 0,
    dominantElements: existingChart.dominantElements || { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 },
    clusters: existingChart.clusters || null
  };
}

// Main integration function for existing UI
export async function runTeacherAudition(existingCharts: any[]): Promise<any> {
  try {
    console.log('[Integration] Starting Teacher Audition with new system');
    
    // Check feature flag
    const useV2 = (window as any).AUDIO_AUDITION_V2 !== false; // Default to true
    if (!useV2) {
      throw new Error('Teacher Audition V2 disabled by feature flag');
    }
    
    // Convert existing charts to ChartContext format
    const charts: ChartContext[] = existingCharts.map(convertToChartContext);
    
    // Run audition
    const result = await initAuditionRunner(charts);
    
    console.log('[Integration] Audition complete:', result);
    return result;
    
  } catch (error) {
    console.error('[Integration] Audition failed:', error.message);
    throw error;
  }
}

// Make available globally
(window as any).runTeacherAudition = runTeacherAudition;
