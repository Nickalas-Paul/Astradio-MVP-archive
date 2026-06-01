/**
 * Unified audio lexicon — perceptual, user-facing language from SemanticCore.audio.
 * Projection rule layer only; no semantic authority changes.
 */

import type { SemanticCore } from '../../semantic/semantic-core';

/** Single dimension: pulse / motion (one listen clause per call; maps `SemanticCore.audio.tempo_band` only). No trailing period. */
export function mapTempo(code: string): string {
  if (code === 'TEMPO_HIGH') return 'The pulse runs light and quick, so phrases turn on short notice';
  if (code === 'TEMPO_LOW') return 'The pulse lengthens, letting each phrase finish before the next';
  return 'The pulse sits in a steady mid-gear';
}

/** Space / crowding between entries (one listen clause per call; `density_band` only). No trailing period. */
export function mapDensity(code: string): string {
  if (code === 'DENSITY_DENSE') return 'Entries stack close, with little air between them';
  if (code === 'DENSITY_SPARSE') return 'Rests stay wide enough to hear each entry clearly';
  return 'Spacing alternates tight and open in a workable balance';
}

/** Energy arc over time (one listen clause per call; `arc_bias` only). No trailing period. */
export function mapArc(code: string): string {
  if (code === 'ARC_SURGE_RESOLVE') return 'Energy lifts sharply, then finds a clear landing';
  if (code === 'ARC_FALL') return 'Energy thins and releases toward the close';
  if (code === 'ARC_RISE') return 'Energy climbs and thickens as the section goes on';
  return 'Energy keeps shifting rather than parking on one plateau';
}

/** Listening pressure (one listen clause per call; `tension_bias` only). No trailing period. */
export function mapTensionBias(code: string): string {
  if (code === 'AUDIO_TENSION_HIGH') return 'Listening pressure stays high, so resolutions defer';
  if (code === 'AUDIO_TENSION_LOW') return 'Listening pressure eases earlier in each gesture';
  return 'Listening pressure sits halfway between ease and strain';
}

/** Voicing / interplay (one listen clause per call; `relational_texture` only). No trailing period. */
export function mapTexture(code: string): string {
  if (code === 'REL_TEXTURE_FLUID') return 'Voices overlap in sustained blend';
  if (code === 'REL_TEXTURE_CALL_RESPONSE') return 'Figures trade in clear answer phrases';
  if (code === 'REL_TEXTURE_STATIC') return 'Layers hold a steady stack with little handoff';
  return 'Voicing stays even, without a strong call-and-response pull';
}

/**
 * Every clause string emitted by `mapTempo` / `mapDensity` / `mapArc` / `mapTensionBias` / `mapTexture`
 * for each ontology code branch. Phase 0 catalog + Phase 2 audio families must stay aligned to this list.
 */
export const AUDIO_LEXICON_CLAUSE_STRINGS: readonly string[] = [
  mapTempo('TEMPO_HIGH'),
  mapTempo('TEMPO_LOW'),
  mapTempo('TEMPO_MED'),
  mapDensity('DENSITY_DENSE'),
  mapDensity('DENSITY_SPARSE'),
  mapDensity('DENSITY_BALANCED'),
  mapArc('ARC_SURGE_RESOLVE'),
  mapArc('ARC_FALL'),
  mapArc('ARC_RISE'),
  mapArc('ARC_CYCLIC'),
  mapTensionBias('AUDIO_TENSION_HIGH'),
  mapTensionBias('AUDIO_TENSION_LOW'),
  mapTensionBias('AUDIO_TENSION_MED'),
  mapTexture('REL_TEXTURE_FLUID'),
  mapTexture('REL_TEXTURE_CALL_RESPONSE'),
  mapTexture('REL_TEXTURE_STATIC'),
  mapTexture('REL_TEXTURE_NEUTRAL'),
];

function escapeAudioLexiconReFragment(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tempo / density / arc / tension clause families (texture is voicing, not an R3 counter). */
export type AudioListenFamilyKind = 'tempo' | 'density' | 'tension' | 'arc';

export function audioListenFamilyUnionRegex(kind: AudioListenFamilyKind, flags: string): RegExp {
  const lex = AUDIO_LEXICON_CLAUSE_STRINGS;
  const ranges: Record<AudioListenFamilyKind, readonly [number, number]> = {
    tempo: [0, 2],
    density: [3, 5],
    arc: [6, 9],
    tension: [10, 12],
  };
  const [lo, hi] = ranges[kind];
  const parts = lex.slice(lo, hi + 1);
  return new RegExp(`(?:${parts.map(escapeAudioLexiconReFragment).join('|')})`, flags);
}

export function countAudioListenFamilyMatches(kind: AudioListenFamilyKind, text: string): number {
  const re = audioListenFamilyUnionRegex(kind, 'g');
  return text.match(re)?.length ?? 0;
}

export function audioListenFamilyHit(kind: AudioListenFamilyKind, text: string): boolean {
  const re = audioListenFamilyUnionRegex(kind, '');
  return re.test(text);
}

/** Deterministic bridge from ExplainSpec BPM to canonical tempo band codes (expression only). */
export function tempoBandCodeFromExplainerBpm(bpm: number): 'TEMPO_HIGH' | 'TEMPO_MED' | 'TEMPO_LOW' {
  if (bpm >= 118) return 'TEMPO_HIGH';
  if (bpm <= 82) return 'TEMPO_LOW';
  return 'TEMPO_MED';
}

/** Deterministic bridge from ExplainSpec density bucket to canonical density codes (expression only). */
export function densityBandCodeFromExplainerBucket(
  bucket: 'low' | 'med' | 'high'
): 'DENSITY_SPARSE' | 'DENSITY_BALANCED' | 'DENSITY_DENSE' {
  if (bucket === 'high') return 'DENSITY_DENSE';
  if (bucket === 'low') return 'DENSITY_SPARSE';
  return 'DENSITY_BALANCED';
}

/** Generic daily / explainer fallback: names the five listen axes without inventing new ones. */
export function genericScoreListenTranslationFallback(): string {
  return 'The score maps the chart into the same five listen dimensions as the main read (pulse, spacing, arc, listening pressure, and voicing) without inventing a second story.';
}

/** First tempo clause only, for mid-sentence glue (same lexicon as `mapTempo`). */
export function mapTempoLeadClauseForEmbed(code: string): string {
  const t = mapTempo(code);
  const comma = t.indexOf(',');
  return comma > 0 ? t.slice(0, comma) : t;
}

/**
 * One light cue for non-owner sections (avoid repeating the full listen stack).
 */
export function lightListenHintFromCore(core: SemanticCore): string {
  return withTerminalPeriod(mapTempoLeadClauseForEmbed(core.audio.tempo_band));
}

export function withTerminalPeriod(s: string): string {
  const t = s.trim();
  if (t.endsWith('.')) return t;
  return `${t}.`;
}
