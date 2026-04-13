/**
 * Ensures Phase 0 catalog, R3 family regex slices, and `AUDIO_LEXICON_CLAUSE_STRINGS` stay aligned.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-audio-lexicon-catalog-alignment.js
 */
import {
  AUDIO_LEXICON_CLAUSE_STRINGS,
  countAudioListenFamilyMatches,
} from '../projection/rule-layer/audio-lexicon';
import { phase0AudioCatalogClauseRef } from '../projection/rule-layer/repetition-collapse-phase0';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`[test-audio-lexicon-catalog-alignment] ${msg}`);
}

function main(): void {
  const lex = AUDIO_LEXICON_CLAUSE_STRINGS;
  assert(phase0AudioCatalogClauseRef() === lex, 'Phase 0 catalog must alias the lexicon clause array');
  assert(new Set(lex).size === lex.length, 'AUDIO_LEXICON_CLAUSE_STRINGS must not contain duplicates');

  const textureClauses = new Set(lex.slice(13, 17));
  for (const clause of lex) {
    const t = countAudioListenFamilyMatches('tempo', clause);
    const d = countAudioListenFamilyMatches('density', clause);
    const ten = countAudioListenFamilyMatches('tension', clause);
    const a = countAudioListenFamilyMatches('arc', clause);
    const sum = t + d + ten + a;
    if (textureClauses.has(clause)) {
      assert(sum === 0, `texture clause must not match R3 families: ${clause.slice(0, 48)}…`);
    } else {
      assert(sum === 1, `non-texture clause must match exactly one R3 family: ${clause.slice(0, 48)}… got ${sum}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, clauseCount: lex.length }, null, 2));
}

main();
