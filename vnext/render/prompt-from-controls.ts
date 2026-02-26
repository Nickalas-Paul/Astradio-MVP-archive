import type { ControlSurfacePayload } from '../explainer/contracts';
import type { Plan } from '../contracts';

const BASE_SAFE_PROMPT =
  'Generate a 30 second instrumental track. Focus on original sound design, abstract rhythm, and evolving texture. No vocals, no spoken word, no lyrics. Avoid recognizable melodies or famous motifs. Keep the composition clearly original.';

function tempoBucket(bpm: number): string {
  if (bpm < 90) return 'slow-tempo';
  if (bpm < 120) return 'medium-tempo';
  return 'fast-tempo';
}

function densityBucket(d: number): string {
  if (d < 0.4) return 'sparse';
  if (d < 0.7) return 'moderate-density';
  return 'dense';
}

function brightnessBucket(t: number): string {
  if (t < 0.3) return 'dark';
  if (t < 0.7) return 'mid-brightness';
  return 'bright';
}

function tensionBucket(t: number): string {
  if (t < 0.33) return 'low-tension';
  if (t < 0.66) return 'medium-tension';
  return 'high-tension';
}

function emphasisBucket(motifRate: number, rhythmTemplateId: number): string {
  if (motifRate > 0.6) return 'melodic';
  if (rhythmTemplateId >= 4) return 'rhythmic';
  return 'balanced';
}

function genreFamily(g?: string): string {
  const x = (g || 'house').toLowerCase();
  if (x === 'classical') return 'orchestral';
  if (x === 'jazz') return 'jazz';
  if (x === 'ambient') return 'ambient';
  return 'electronic';
}

/**
 * Build Lyria prompt: safe base + up to 6 deterministic tags to avoid recitation blocks.
 */
export function buildLyriaPrompt(
  payload: ControlSurfacePayload,
  plan?: Plan | { bpm?: number; key?: string }
): string {
  const tempoNorm = typeof payload.tempo_norm === 'number' ? payload.tempo_norm : 0.5;
  const density = typeof payload.density_level === 'number' ? payload.density_level : 0.5;
  const tension = typeof payload.aspect_tension === 'number' ? payload.aspect_tension : 0.5;
  const motifRate = typeof payload.motif_rate === 'number' ? payload.motif_rate : 0.5;
  const rhythmTemplateId = typeof payload.rhythm_template_id === 'number' ? payload.rhythm_template_id : 0;

  const bpm = plan && typeof (plan as Plan).bpm === 'number' ? (plan as Plan).bpm : Math.round(90 + tempoNorm * 60);
  const tags: string[] = [
    tempoBucket(bpm),
    densityBucket(density),
    brightnessBucket(tension),
    tensionBucket(tension),
    emphasisBucket(motifRate, rhythmTemplateId),
    genreFamily(payload.genre),
  ];
  return `${BASE_SAFE_PROMPT} Tags: ${tags.join(', ')}.`;
}
