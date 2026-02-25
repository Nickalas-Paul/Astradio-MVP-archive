import type { ControlSurfacePayload } from '../explainer/contracts';

/**
 * Build a short US English text prompt for Lyria from control-surface payload and plan.
 * Lyria expects genre, mood, instrumentation, tempo.
 * Wording avoids recitation-check triggers: explicitly original, generic instrumentation.
 */
export function buildLyriaPrompt(
  payload: ControlSurfacePayload,
  plan?: { bpm?: number; key?: string }
): string {
  const genre = payload.genre || 'house';
  const tempoNorm = typeof payload.tempo_norm === 'number' ? payload.tempo_norm : 0.5;
  const density = typeof payload.density_level === 'number' ? payload.density_level : 0.5;
  const element = payload.element_dominance || 'fire';
  const bpm = plan?.bpm ?? Math.round(90 + tempoNorm * 60);
  const tempo = bpm < 100 ? 'medium tempo' : bpm < 130 ? 'upbeat tempo' : 'fast tempo';
  const densityWord = density < 0.4 ? 'minimal' : density < 0.7 ? 'moderate' : 'dense';
  const mood = element === 'fire' ? 'energetic' : element === 'earth' ? 'grounded' : element === 'air' ? 'light' : 'fluid';
  // Lyria recitation checks block prompts resembling copyrighted content. Use minimal,
  // abstract wording that mirrors Google's documented example structure.
  return `An instrumental ${genre} piece with a gentle melody and soft accompaniment. ${tempo}. No vocals.`;
}
