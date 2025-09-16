// vnext/client-integration.ts - Frontend integration helpers
import type { Plan } from './contracts';
import { planToToneEvents, validatePlanForAudio } from './scheduler';

export interface VNextAudioConfig {
  baseUrl?: string;
  onProgress?: (progress: number) => void;
  onError?: (error: string) => void;
}

/**
 * Client-side helper to fetch vNext plan and convert to Tone.js events
 */
export async function fetchVNextPlan(
  chartContext: any, 
  config: VNextAudioConfig = {}
): Promise<{ plan: Plan; audioEvents: any[]; valid: boolean }> {
  const baseUrl = config.baseUrl || '';
  
  try {
    // Fetch plan from vNext compose endpoint
    const response = await fetch(`${baseUrl}/api/vnext/compose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chartContext })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || 'Unknown error from vNext compose');
    }
    
    const plan: Plan = result.plan;
    
    // Validate plan for audio
    const validation = validatePlanForAudio(plan);
    if (!validation.valid) {
      config.onError?.(`Plan validation failed: ${validation.issues.join(', ')}`);
      return { plan, audioEvents: [], valid: false };
    }
    
    // Convert to Tone.js events
    const audioEvents = planToToneEvents(plan);
    
    return { plan, audioEvents, valid: true };
    
  } catch (error: any) {
    config.onError?.(error.message);
    throw error;
  }
}

/**
 * Client-side helper to render vNext plan to audio
 */
export async function renderVNextPlan(
  plan: Plan,
  config: VNextAudioConfig = {}
): Promise<{ ok: boolean; audioEvents?: any[]; error?: string }> {
  const baseUrl = config.baseUrl || '';
  
  try {
    const response = await fetch(`${baseUrl}/api/vnext/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error: any) {
    return { ok: false, error: error.message };
  }
}

/**
 * Integration with existing Tone.js setup
 * This function can be called from the frontend to seamlessly integrate vNext
 */
export async function integrateVNextWithTone(
  chartContext: any,
  toneSetup: (audioEvents: any[]) => void,
  config: VNextAudioConfig = {}
): Promise<boolean> {
  try {
    const { plan, audioEvents, valid } = await fetchVNextPlan(chartContext, config);
    
    if (!valid) {
      return false;
    }
    
    // Call the existing Tone.js setup function
    toneSetup(audioEvents);
    
    return true;
    
  } catch (error: any) {
    config.onError?.(error.message);
    return false;
  }
}
