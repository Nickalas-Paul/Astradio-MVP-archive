/**
 * Deterministic Renderer v1.0
 * Renders ExplainSpec to professional explanation sections.
 * 
 * Rules:
 * - No duplicate sentences across sections
 * - No inline bullet glyphs (bullets must be arrays)
 * - No em dashes (use commas or periods)
 * - Complete sentences, proper paragraph breaks
 */

import type { ExplainSpec, ExplanationSection } from '../spec-contracts';

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
  
  // Build Astrological Signatures (2-4 sentences)
  const signaturesText = renderSignatures(signatures, spec.seed);
  
  // Build Personal Significance (1-2 paragraphs)
  const significanceText = renderSignificance(signatures, psychology, spec.seed);
  
  // Build Musical Identity and Flow (1 paragraph + bullets)
  const musicalText = renderMusical(music, spec.seed);
  const musicalBullets = spec.listeningCues.slice(0, 6);
  
  // Dedupe sentences across sections
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
// Single-chart rendering

function renderSignatures(signatures: import('../spec-contracts').SignatureFacts, seed: string): string {
  const sentences: string[] = [];
  
  // Tone line (element blend + planets)
  const topElement = Object.entries(signatures.elementBlend)
    .sort((a, b) => b[1] - a[1])[0];
  const elementAdjs: Record<string, string[]> = {
    fire: ['energetic', 'passionate', 'bold'],
    earth: ['grounded', 'practical', 'steady'],
    air: ['curious', 'analytical', 'communicative'],
    water: ['intuitive', 'empathetic', 'flowing']
  };
  const adj = elementAdjs[topElement[0]]?.[0] || 'balanced';
  const planetStr = signatures.dominantPlanets.length > 0 
    ? ` ${signatures.dominantPlanets[0]} and ${signatures.dominantPlanets.slice(1).join(', ')}` 
    : '';
  sentences.push(`Tone: ${adj}${planetStr ? ',' + planetStr : ''}.`);
  
  // Movement (element blend + tension)
  const movementTemplates = [
    "Motion stays mostly connected and stepwise",
    "Movement flows with balanced temperament",
    "The pattern moves with measured steps",
    "Motion shifts with ${topElement[0]} element influence"
  ];
  const rng = createSeededRNG(seed);
  const movementIdx = Math.floor(rng() * movementTemplates.length);
  let movement = movementTemplates[movementIdx];
  movement = movement.replace('${topElement[0]}', topElement[0]);
  sentences.push(movement + '.');
  
  // Arc description
  const arcTemplates = [
    "The shape builds and releases, with balanced temperament",
    "Tension rises then eases, reflecting the elemental mix",
    "The arc lifts and comes down, showing ${topElement[0]} influence"
  ];
  const arcIdx = Math.floor(rng() * arcTemplates.length);
  let arc = arcTemplates[arcIdx];
  arc = arc.replace('${topElement[0]}', topElement[0]);
  sentences.push(arc + '.');
  
  // Optional: tension/clustering note (if significant)
  if (signatures.tensionBucket === 'high' || signatures.clusteringBucket === 'high') {
    sentences.push(`Tension and clustering signals show ${signatures.tensionBucket} tension with ${signatures.clusteringBucket} clustering.`);
  }
  
  return sentences.slice(0, 4).join(' ');
}

function renderSignificance(
  signatures: import('../spec-contracts').SignatureFacts,
  psychology: import('../spec-contracts').PsychologyFacts,
  seed: string
): string {
  const paragraphs: string[] = [];
  
  // First paragraph: attention style and pacing
  const p1 = `The chart points to a particular style of attention and pacing: ${psychology.attentionStyle}, with ${psychology.pacing} rhythm.`;
  paragraphs.push(p1);
  
  // Second paragraph: "because" reasoning
  const topElement = Object.entries(signatures.elementBlend)
    .sort((a, b) => b[1] - a[1])[0];
  const p2 = `Because the ${topElement[0]} element blend and ${signatures.dominantPlanets.length > 0 ? signatures.dominantPlanets[0] : 'planetary'} influences shape how we hold tension and repetition, this shows up as ${psychology.relatingStyle} relating style.`;
  paragraphs.push(p2);
  
  // Disclaimer
  paragraphs.push('\n\nThis is a personality-style reading mapped into musical decisions, not a prediction.');
  
  return paragraphs.join(' ');
}

function renderMusical(music: import('../spec-contracts').MusicFacts, seed: string): string {
  const sentences: string[] = [];
  
  // Tempo and density
  sentences.push(`Tempo sits in a ${music.bpm} BPM range, density is ${music.densityBucket}, register leans ${music.registerBias}.`);
  
  // Motion and articulation
  sentences.push(`Motion and articulation show ${music.motionBucket} motion with ${music.articulationBucket} articulation.`);
  
  // Harmonic posture
  sentences.push(`Harmonic posture is ${music.harmonicPosture === 'root-stable' ? 'root-stable' : 'color-shifting'}.`);
  
  // Arc summary (begin/middle/end)
  sentences.push(`${music.arcSummary.begin}. ${music.arcSummary.middle}. ${music.arcSummary.end}.`);
  
  return sentences.join(' ');
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
