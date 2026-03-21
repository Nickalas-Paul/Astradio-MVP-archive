/**
 * Stage 7 v1 — Structural theme tags only (closed vocabulary, deterministic).
 */

import type { ConnectionActivationV1 } from './fold-mean-v1';
import type { CrossAspectHitInternal } from './cross-aspects-v1';

export function deriveDominantThemesV1(
  activation: ConnectionActivationV1,
  allHits: CrossAspectHitInternal[]
): string[] {
  const themes: string[] = [];

  if (activation.friction > activation.harmony + 0.05) themes.push('friction_over_harmony');
  if (activation.harmony > activation.friction + 0.05) themes.push('harmony_over_friction');

  if (activation.volatility > 0.25) themes.push('elevated_volatility');
  if (activation.growth_pressure > 0.25) themes.push('elevated_growth_pressure');
  if (activation.emotional_activation > 0.25) themes.push('emotional_emphasis');
  if (activation.communication_emphasis > 0.2) themes.push('communication_emphasis');

  let outerToPersonal = 0;
  for (const h of allHits) {
    const o = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].includes(h.transitBody);
    const p = ['sun', 'moon', 'mercury', 'venus', 'mars'].includes(h.natalBody);
    if (o && p) outerToPersonal++;
  }
  if (outerToPersonal >= 3) themes.push('outer_to_personal');

  themes.sort((a, b) => a.localeCompare(b, 'en'));
  return Array.from(new Set(themes));
}
