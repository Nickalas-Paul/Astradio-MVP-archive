/**
 * Transit overlay closing listen synthesis — "Today's Sound" (temporal, ephemeral framing).
 */

import type { AudioProjectionEnvelope, SemanticCore } from '../../semantic/semantic-core';
import { capToMaxSentences } from './claim-synthesize';
import { getAspectInsight } from '../insight-library/insight-library-index';
import type { RankedActivation } from './transit-overlay-curation';

const TODAYS_SOUND_MAX_CHARS = 500;
const TODAYS_SOUND_MAX_SENTENCES = 3;

function tempoClauseForTransit(audio: AudioProjectionEnvelope): string {
  if (audio.tempo_band === 'TEMPO_HIGH') return 'light and quick';
  if (audio.tempo_band === 'TEMPO_LOW') return 'patient, unhurried';
  return 'steady, present';
}

function densityClauseForTransit(audio: AudioProjectionEnvelope): string {
  if (audio.density_band === 'DENSITY_DENSE') return 'dense, closely layered';
  if (audio.density_band === 'DENSITY_SPARSE') return 'spacious, open';
  return 'balanced';
}

function truncateToMaxChars(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > max * 0.6) return `${cut.slice(0, lastSpace).trim()}.`;
  return `${cut.trim()}.`;
}

export function buildTransitListenMetaphor(
  semanticCore: SemanticCore,
  selectedActivations: readonly RankedActivation[]
): string {
  const audio = semanticCore.audio;
  const tempoClause = tempoClauseForTransit(audio);
  const densityClause = densityClauseForTransit(audio);

  let text = `The tempo of today's transits moves at a ${tempoClause} pace`;

  const sonicClips: string[] = [];
  for (const activation of selectedActivations.slice(0, 3)) {
    const insight = getAspectInsight(activation.aspectKey);
    if (insight?.sonic) {
      const clip = capToMaxSentences(insight.sonic, 1);
      if (clip) sonicClips.push(clip);
    }
  }

  if (sonicClips.length > 0) {
    text += `, with a ${densityClause} harmonic texture. `;
    text += sonicClips[0]!;
    if (sonicClips.length > 1 && text.length < 350) {
      text += ` ${sonicClips[1]!}`;
    }
  } else {
    text += ". Listen for the quality of this moment's particular presence.";
  }

  return truncateToMaxChars(capToMaxSentences(text, TODAYS_SOUND_MAX_SENTENCES), TODAYS_SOUND_MAX_CHARS);
}
