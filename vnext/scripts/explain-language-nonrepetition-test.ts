/**
 * ExplainSpec Language Non-Repetition Test
 * Acceptance tests for Personal Significance + Musical Identity and Flow:
 * - No sentence appears more than once within a section.
 * - No paragraph contains the same 5-word sequence repeated.
 * - No sentence prefix (first 3 words) repeats within a section.
 * - No repeated lead-in like "In sound," across multiple lines.
 */
import type { ExplainSpec } from '../explainer/spec-contracts';
import { renderExplainSpecToSections } from '../explainer/renderers/deterministic';

function splitParagraphs(text: string): string[] {
  return (text ?? '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function splitSentences(text: string): string[] {
  return (text ?? '')
    .replace(/\s+/g, ' ')
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/[.!?]$/.test(s) ? s : s + '.'));
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fiveWordRepeats(paragraph: string): string[] {
  const words = norm(paragraph).split(' ').filter(Boolean);
  const counts = new Map<string, number>();
  for (let i = 0; i + 5 <= words.length; i++) {
    const gram = words.slice(i, i + 5).join(' ');
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([g]) => g);
}

function sentencePrefix(sentence: string): string {
  const words = norm(sentence).split(' ').filter(Boolean);
  return words.slice(0, 3).join(' ');
}

function assertNoDuplicateSentences(sectionId: string, text: string): void {
  const sents = splitSentences(text);
  const seen = new Map<string, number>();
  for (const s of sents) {
    const k = norm(s);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const dups = Array.from(seen.entries()).filter(([, c]) => c > 1);
  if (dups.length) {
    console.error(`❌ FAIL: Section "${sectionId}" has duplicate sentences`);
    console.error(dups.slice(0, 5).map(([k, c]) => `  (${c}x) ${k}`).join('\n'));
    process.exit(1);
  }
}

function assertNoRepeatedFiveWordSequences(sectionId: string, text: string): void {
  for (const para of splitParagraphs(text)) {
    const repeats = fiveWordRepeats(para);
    if (repeats.length) {
      console.error(`❌ FAIL: Section "${sectionId}" paragraph repeats a 5-word sequence`);
      console.error(`  Example repeat: "${repeats[0]}"`);
      process.exit(1);
    }
  }
}

function assertNoRepeatedPrefixes(sectionId: string, text: string): void {
  const sents = splitSentences(text);
  const seen = new Map<string, number>();
  for (const s of sents) {
    const p = sentencePrefix(s);
    if (!p) continue;
    seen.set(p, (seen.get(p) ?? 0) + 1);
  }
  const repeats = Array.from(seen.entries()).filter(([, c]) => c > 1);
  if (repeats.length) {
    console.error(`❌ FAIL: Section "${sectionId}" repeats sentence lead-ins`);
    console.error(repeats.slice(0, 8).map(([p, c]) => `  (${c}x) "${p}"`).join('\n'));
    process.exit(1);
  }
  // Explicit guard against the previously repeated template.
  const inSoundCount = sents.filter((s) => norm(s).startsWith('in sound')).length;
  if (inSoundCount > 0) {
    console.error(`❌ FAIL: Section "${sectionId}" still contains "In sound" lead-ins`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('Running ExplainSpec language non-repetition test...');
  const spec: ExplainSpec = {
    specVersion: 'ExplainSpecV1',
    mode: 'single',
    seed: 'test-seed',
    titles: {
      signatures: 'Astrological Signatures',
      significance: 'Personal Significance',
      musical: 'Musical Identity and Flow'
    },
    listeningCues: [],
    evidence: [],
    single: {
      signatures: {
        elementBlend: { fire: 0.35, earth: 0.2, air: 0.25, water: 0.2 },
        dominantPlanets: ['Moon', 'Saturn', 'Mercury'],
        tensionBucket: 'med',
        clusteringBucket: 'med',
        moonPhaseBucket: 'med'
      },
      psychology: {
        temperamentWords: ['grounded', 'curious'],
        attentionStyle: 'focused',
        pacing: 'measured',
        relatingStyle: 'direct'
      },
      music: {
        bpm: 74,
        key: 'C minor',
        densityBucket: 'med',
        registerBias: 'mid',
        articulationBucket: 'med',
        motionBucket: 'med',
        harmonicPosture: 'color-shifting',
        arcSummary: {
          begin: 'Encounter introduces two harmonic colors',
          middle: 'Recognition develops the theme with stepwise motion',
          end: 'Integration resolves with color emphasis'
        },
        planSummary: {
          bpm: 74,
          key: 'C minor',
          densityBucket: 'balanced',
          melodyEventCount: 18,
          harmonyEventCount: 12,
          avgMelodicInterval: 2.6,
          integrationTonicPull: 0.55
        } as any
      },
      // Minimal AstroProfile shape required by the renderer.
      profile: {
        emphasis: {
          elementsBySign: { fire: 6, earth: 3, air: 4, water: 2 },
          modalitiesBySign: { cardinal: 4, fixed: 5, mutable: 6 }
        },
        angles: { ASC: { sign: 'Aries' } },
        planets: [],
        aspects: []
      } as any,
      prominentPlanets: [
        { name: 'Moon', sign: 'Gemini', house: 3, nearAngle: null },
        { name: 'Saturn', sign: 'Virgo', house: 6, nearAngle: null },
        { name: 'Mercury', sign: 'Taurus', house: 2, nearAngle: null },
        { name: 'Venus', sign: 'Cancer', house: 4, nearAngle: null }
      ] as any,
      prominentAspects: [
        { a: 'Moon', b: 'Saturn', type: 'square', orb: 2.1, tightness: 'med' }
      ] as any
    }
  };

  const rendered = renderExplainSpecToSections(spec);
  const sections = rendered.sections || [];
  const sig = sections.find((s: any) => s.id === 'significance');
  const mus = sections.find((s: any) => s.id === 'musical');

  if (!sig?.text || !mus?.text) {
    console.error('❌ FAIL: Missing significance or musical section text');
    process.exit(1);
  }

  assertNoDuplicateSentences('significance', sig.text);
  assertNoDuplicateSentences('musical', mus.text);
  assertNoRepeatedFiveWordSequences('significance', sig.text);
  assertNoRepeatedFiveWordSequences('musical', mus.text);
  assertNoRepeatedPrefixes('significance', sig.text);
  assertNoRepeatedPrefixes('musical', mus.text);

  console.log('✅ PASS: No repetition issues detected in significance/musical sections');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

