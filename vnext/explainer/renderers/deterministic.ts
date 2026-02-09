/**
 * Deterministic Renderer v1.1
 * Renders ExplainSpec with strict section contracts: Astrology → Psychology → Music.
 *
 * 1) Astrological Signatures: Chart only. Elements as field/atmosphere, planets as symbolic operators, structure. No psychology, no music.
 * 2) Personal Significance: Translate astrology → psychology with "because". No music, no raw astro repeat.
 * 3) Musical Identity and Flow: How music mirrors prior sections. Bullets as "listen for..." / "notice how..." cues only.
 */

import type {
  ExplainSpec,
  ExplanationSection,
  SignatureFacts,
  PsychologyFacts,
  MusicFacts
} from '../spec-contracts';

/**
 * Render ExplainSpec to explanation sections.
 */
export function renderExplainSpecToSections(spec: ExplainSpec): { sections: ExplanationSection[] } {
  if (spec.mode === "single") {
    return renderSingleSpec(spec);
  } else {
    return renderComparisonSpec(spec);
  }
}

function renderSingleSpec(spec: ExplainSpec): { sections: ExplanationSection[] } {
  if (!spec.single) throw new Error("Single spec missing single facts");
  
  const { signatures, psychology, music } = spec.single;
  
  const signaturesText = buildAstrologicalNarrative(signatures, spec.seed);
  const significanceText = buildPsychologicalNarrative(signatures, psychology, spec.seed);
  const { paragraph: musicalText, bullets: musicalBullets } = buildMusicalNarrative(
    signatures,
    psychology,
    music,
    spec.seed
  );

  const deduped = dedupeSections(signaturesText, significanceText, musicalText, musicalBullets);

  return {
    sections: [
      { id: "signatures", title: spec.titles.signatures, text: deduped.signatures },
      { id: "significance", title: spec.titles.significance, text: deduped.significance },
      {
        id: "musical",
        title: spec.titles.musical,
        text: deduped.musical,
        bullets: deduped.bullets
      }
    ]
  };
}

function renderComparisonSpec(spec: ExplainSpec): { sections: ExplanationSection[] } {
  if (!spec.comparison) throw new Error("Comparison spec missing comparison facts");
  
  const { a, b, delta, music } = spec.comparison;
  
  // Shared Signatures
  const signaturesText = renderComparisonSignatures(a, b, delta, spec.seed);
  
  // Points of Friction and Growth
  const significanceText = renderComparisonSignificance(delta, spec.seed);
  
  // Musical Relationship and Blend
  const musicalText = renderComparisonMusical(music, spec.seed);
  const musicalBullets = spec.listeningCues.slice(0, 6);
  
  const deduped = dedupeSections(signaturesText, significanceText, musicalText, musicalBullets);
  
  return {
    sections: [
      {
        id: "signatures",
        title: spec.titles.signatures,
        text: deduped.signatures
      },
      {
        id: "significance",
        title: spec.titles.significance,
        text: deduped.significance
      },
      {
        id: "musical",
        title: spec.titles.musical,
        text: deduped.musical,
        bullets: deduped.bullets
      }
    ]
  };
}

// ============================================================================
// Section 1: Astrological Signatures (chart only; symbolic, archetypal)

/** Planet as symbolic operator (archetypal function in the chart). */
const PLANET_OPERATOR: Record<string, string> = {
  Sun: 'identity and vitality',
  Moon: 'regulation and emotional rhythm',
  Mercury: 'cognition and exchange',
  Venus: 'relating and harmony',
  Mars: 'initiative and drive',
  Jupiter: 'expansion and meaning',
  Saturn: 'structure and boundary',
  Uranus: 'shift and innovation',
  Neptune: 'dissolution and imagination',
  Pluto: 'intensity and transformation'
};

/** Element as field or atmosphere (not personality traits). */
const ELEMENT_FIELD: Record<string, string> = {
  fire: 'a field of initiative and warmth',
  earth: 'a field of substance and form',
  air: 'a field of idea and exchange',
  water: 'a field of feeling and flow'
};

function buildAstrologicalNarrative(signatures: SignatureFacts, _seed: string): string {
  const sentences: string[] = [];

  const sorted = Object.entries(signatures.elementBlend).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  const topName = top[0];
  const field = ELEMENT_FIELD[topName] ?? 'a balanced elemental field';
  sentences.push(`The chart holds ${field}.`);

  if (signatures.dominantPlanets.length > 0) {
    const planet = signatures.dominantPlanets[0];
    const op = PLANET_OPERATOR[planet] ?? 'influence';
    sentences.push(`${planet} operates as ${op}.`);
    if (signatures.dominantPlanets.length >= 2) {
      const second = signatures.dominantPlanets[1];
      const op2 = PLANET_OPERATOR[second] ?? 'influence';
      sentences.push(`${second} contributes ${op2}.`);
    }
  }

  if (signatures.tensionBucket !== 'low' || signatures.clusteringBucket !== 'low') {
    const tensionPhrase =
      signatures.tensionBucket === 'high'
        ? 'Tension in the chart is pronounced'
        : signatures.tensionBucket === 'med'
          ? 'Tension is moderate'
          : 'Tension is low';
    const clusterPhrase =
      signatures.clusteringBucket === 'high'
        ? 'with strong clustering of energies'
        : signatures.clusteringBucket === 'med'
          ? 'with moderate clustering'
          : 'with diffuse emphasis';
    sentences.push(`${tensionPhrase}, ${clusterPhrase}.`);
  }

  return sentences.slice(0, 4).join(' ');
}

// ============================================================================
// Section 2: Personal Significance (astrology → psychology; "because" clause)

function buildPsychologicalNarrative(
  signatures: SignatureFacts,
  psychology: PsychologyFacts,
  seed: string
): string {
  const top = Object.entries(signatures.elementBlend).sort((a, b) => b[1] - a[1])[0];
  const planet = signatures.dominantPlanets[0];

  const planetPhrase = planet ? `${planet} ` : '';
  const p1 = `Because the ${top[0]} element and ${planetPhrase}influence shape how tension and repetition are held, temperament leans toward ${psychology.temperamentWords.join(' and ')}.`;
  const p2 = `Attention tends toward ${psychology.attentionStyle} focus, with ${psychology.pacing} pacing and ${psychology.relatingStyle} relating.`;

  const disclaimer =
    '\n\nThis is a personality-style reading mapped into musical decisions, not a prediction.';
  return p1 + ' ' + p2 + disclaimer;
}

// ============================================================================
// Section 3: Musical Identity and Flow (mirrors prior sections; listening-cue bullets)

function buildMusicalNarrative(
  _signatures: SignatureFacts,
  _psychology: PsychologyFacts,
  music: MusicFacts,
  _seed: string
): { paragraph: string; bullets: string[] } {
  const sentences: string[] = [];

  sentences.push(
    `The composition mirrors these patterns in sound: a ${music.bpm} BPM pulse and ${music.densityBucket} texture, with register leaning ${music.registerBias}.`
  );
  sentences.push(
    `Motion is ${music.motionBucket}, articulation ${music.articulationBucket}; harmony holds a ${music.harmonicPosture} stance.`
  );
  sentences.push(
    `${music.arcSummary.begin}. ${music.arcSummary.middle}. ${music.arcSummary.end}.`
  );

  const paragraph = sentences.join(' ');

  const densityLabel =
    music.densityBucket === 'high' ? 'layered texture' : music.densityBucket === 'low' ? 'open texture' : 'balanced texture';
  const bullets: string[] = [];
  bullets.push(`Listen for the ${music.bpm} BPM pulse.`);
  bullets.push(`Notice how ${music.motionBucket} motion shapes the phrase.`);
  bullets.push(`Listen for ${music.registerBias} register.`);
  bullets.push(`Notice how ${densityLabel} supports the arc.`);
  if (music.planSummary?.avgMelodicInterval != null) {
    bullets.push(
      `Listen for motion around ${music.planSummary.avgMelodicInterval.toFixed(0)}-semitone steps.`
    );
  }
  bullets.push(`Notice how harmonic posture stays ${music.harmonicPosture}.`);

  const unique = Array.from(new Set(bullets)).slice(0, 6);
  return { paragraph, bullets: unique };
}

// ============================================================================
// Comparison rendering

function renderComparisonSignatures(
  a: import('../spec-contracts').ChartExplainFacts,
  b: import('../spec-contracts').ChartExplainFacts,
  delta: import('../spec-contracts').ComparisonFacts,
  seed: string
): string {
  const sentences: string[] = [];
  
  // Shared elements
  if (delta.sharedElements.length > 0) {
    sentences.push(`Both charts share ${delta.sharedElements.join(', ')} influences.`);
  }
  
  // Element blend comparison
  const aTop = Object.entries(a.elementBlend).sort((a, b) => b[1] - a[1])[0];
  const bTop = Object.entries(b.elementBlend).sort((a, b) => b[1] - a[1])[0];
  sentences.push(`Chart A emphasizes ${aTop[0]} element (${(aTop[1] * 100).toFixed(0)}%), while Chart B emphasizes ${bTop[0]} element (${(bTop[1] * 100).toFixed(0)}%).`);
  
  // Resonance
  sentences.push(`Element overlap shows ${(delta.resonance * 100).toFixed(0)}% resonance.`);
  
  return sentences.join(' ');
}

function renderComparisonSignificance(
  delta: import('../spec-contracts').ComparisonFacts,
  seed: string
): string {
  const paragraphs: string[] = [];
  
  // Friction points
  if (delta.frictionPoints.length > 0) {
    const friction = delta.frictionPoints[0];
    paragraphs.push(`Points of friction emerge in ${friction.metric}: ${friction.note}.`);
  }
  
  // Contrasts
  if (delta.contrasts.length > 0) {
    const contrast = delta.contrasts[0];
    paragraphs.push(`The contrast in ${contrast.aspect} (${contrast.a} vs ${contrast.b}) creates dynamic tension and growth potential.`);
  }
  
  // Disclaimer
  paragraphs.push('\n\nThis comparison reflects personality-style patterns, not predictions about relationship outcomes.');
  
  return paragraphs.join(' ');
}

function renderComparisonMusical(
  music: import('../spec-contracts').ComparisonMusicFacts,
  seed: string
): string {
  const sentences: string[] = [];
  
  sentences.push(music.tempoBlend + '.');
  sentences.push(music.densityBlend + '.');
  sentences.push(music.harmonicRelationship + '.');
  sentences.push(music.arcBlend + '.');
  
  return sentences.join(' ');
}

// ============================================================================
// Deduplication

function dedupeSections(
  signatures: string,
  significance: string,
  musical: string,
  bullets: string[]
): { signatures: string; significance: string; musical: string; bullets: string[] } {
  // Extract sentences (split on period + space or newline)
  const sigSents = extractSentences(signatures);
  const sigSentsLower = sigSents.map(s => s.toLowerCase().trim());
  
  // Remove duplicates from significance
  let sigText = significance;
  for (const sent of sigSentsLower) {
    const sigSentences = extractSentences(sigText);
    sigText = sigSentences
      .filter(s => s.toLowerCase().trim() !== sent)
      .join('. ')
      .replace(/\.\s*\./g, '.');
  }
  
  // Remove duplicates from musical
  let musText = musical;
  for (const sent of sigSentsLower) {
    const musSentences = extractSentences(musText);
    musText = musSentences
      .filter(s => s.toLowerCase().trim() !== sent)
      .join('. ')
      .replace(/\.\s*\./g, '.');
  }
  
  // Remove duplicates from bullets (don't repeat paragraph or signatures)
  const allSentences = [
    ...extractSentences(signatures),
    ...extractSentences(significance),
    ...extractSentences(musical)
  ].map(s => s.toLowerCase().trim());
  const dedupedBullets = bullets.filter(b => {
    const bLower = b.toLowerCase().trim();
    return !allSentences.some(s => s.includes(bLower) || bLower.includes(s));
  });
  
  // Strip banned filler and em dashes
  return {
    signatures: stripBannedFiller(signatures),
    significance: stripBannedFiller(sigText),
    musical: stripBannedFiller(musText),
    bullets: dedupedBullets.map(stripBannedFiller)
  };
}

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.endsWith('.') || s.endsWith('!') || s.endsWith('?') ? s : s + '.');
}

function stripBannedFiller(text: string): string {
  // Remove banned filler phrases
  const banned = /cosmic forces|celestial dance|stellar (forces|weight)|planetary energies (flow|move)|cosmic (clarity|weight|motifs)/gi;
  text = text.replace(banned, '');
  
  // Replace em dashes with commas
  text = text.replace(/—/g, ', ');
  text = text.replace(/–/g, ', ');
  
  // Clean up multiple spaces
  text = text.replace(/\s+/g, ' ');
  
  return text.trim();
}

// ============================================================================
// Seeded RNG

function createSeededRNG(seed: string): () => number {
  let state = hashToUint32(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

function hashToUint32(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash >>> 0;
}
