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
  // Lyria recitation checks block prompts/output that could match copyrighted works.
  // Use abstract, generative wording: unique descriptions that yield original output.
  if (genre === 'house' || genre === 'electronic') {
    return 'Abstract instrumental electronic music with soft pads, subtle percussion, and atmospheric texture. No vocals, no recognizable melody.';
  }
  return `Abstract instrumental ${genre} with soft textures and gentle rhythm. No vocals.`;
}
