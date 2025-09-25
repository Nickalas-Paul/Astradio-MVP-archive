// vnext/explainer/overlay-delta.ts
// Overlay Δ threshold enforcement for Unified Spec v1.1

export interface DeltaThresholds {
  step_bias: number;
  syncopation_bias: number;
  density_level: number;
}

export const OVERLAY_THRESHOLDS: DeltaThresholds = {
  step_bias: 0.10,
  syncopation_bias: 0.15,
  density_level: 0.20
};

/**
 * Determines if contrast text should be emitted based on delta thresholds
 * @param kind The type of control being compared
 * @param deltaAbs The absolute difference between natal and current values
 * @returns true if contrast should be shown, false otherwise
 */
export function shouldContrast(kind: keyof DeltaThresholds, deltaAbs: number): boolean {
  const threshold = OVERLAY_THRESHOLDS[kind];
  return deltaAbs >= threshold;
}

/**
 * Check if any overlay deltas exceed thresholds
 * @param deltas Object containing delta values for each control
 * @returns true if any delta exceeds its threshold
 */
export function hasSignificantDeltas(deltas: Partial<DeltaThresholds>): boolean {
  return Object.entries(deltas).some(([kind, delta]) => {
    if (delta === undefined) return false;
    return shouldContrast(kind as keyof DeltaThresholds, Math.abs(delta));
  });
}
