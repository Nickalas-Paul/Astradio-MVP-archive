// vnext/scripts/determinism-normalizer.ts
// Normalizes responses for deterministic comparison

export interface NormalizationExclusions {
  timestamp: boolean;
  latency: boolean;
  audioUrl: boolean;
}

export const DEFAULT_EXCLUSIONS: NormalizationExclusions = {
  timestamp: true,
  latency: true,
  audioUrl: false  // Audio URL is now seed-derived, so keep it
};

/**
 * Normalizes a response object for deterministic comparison
 * @param response The API response to normalize
 * @param exclusions Fields to exclude from comparison
 * @returns Normalized response object
 */
export function normalizeResponse(
  response: any, 
  exclusions: Partial<NormalizationExclusions> = DEFAULT_EXCLUSIONS
): any {
  const normalized = JSON.parse(JSON.stringify(response));
  
  if (exclusions.timestamp && normalized.artifacts?.timestamp) {
    normalized.artifacts.timestamp = "";
  }
  
  if (exclusions.latency && normalized.audio?.latency_ms) {
    normalized.audio.latency_ms = 0;
  }
  
  if (exclusions.audioUrl && normalized.audio?.url) {
    normalized.audio.url = normalized.audio.url.split('?')[0];
  }
  
  return normalized;
}

/**
 * Computes hash of normalized response for deterministic comparison
 * @param response The API response
 * @param exclusions Fields to exclude
 * @returns Hash string
 */
export function hashNormalizedResponse(
  response: any,
  exclusions: Partial<NormalizationExclusions> = DEFAULT_EXCLUSIONS
): string {
  const normalized = normalizeResponse(response, exclusions);
  const json = JSON.stringify(normalized, Object.keys(normalized).sort());
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    const char = json.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
