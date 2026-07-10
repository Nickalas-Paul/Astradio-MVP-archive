export type ComposeVisualControls = {
  arcShape: number;
  densityLevel: number;
  tempoNorm: number;
  aspectTension: number;
  elementDominance: string;
  modality: string;
};

export function extractComposeVisualControls(
  payload: Record<string, unknown>,
): ComposeVisualControls {
  const controls = (payload.controls ?? payload) as Record<string, unknown> | undefined;
  return {
    arcShape: typeof controls?.arc_shape === 'number' ? controls.arc_shape : 0.5,
    densityLevel: typeof controls?.density_level === 'number' ? controls.density_level : 0.5,
    tempoNorm: typeof controls?.tempo_norm === 'number' ? controls.tempo_norm : 0.5,
    aspectTension: typeof controls?.aspect_tension === 'number' ? controls.aspect_tension : 0.5,
    elementDominance:
      typeof controls?.element_dominance === 'string' ? controls.element_dominance : 'earth',
    modality: typeof controls?.modality === 'string' ? controls.modality : 'fixed',
  };
}
