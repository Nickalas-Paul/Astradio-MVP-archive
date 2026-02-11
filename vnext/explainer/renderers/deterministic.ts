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
import type { AstroProfile } from '../../astro/profile-from-snapshot';

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

  const { signatures, psychology, music, factorMap, profile, prominentPlanets, prominentAspects } = spec.single;

  let signaturesText = buildAstrologicalNarrative(signatures, spec.seed, profile, prominentPlanets, prominentAspects);
  let significanceText = buildPsychologicalNarrative(signatures, psychology, spec.seed, profile, prominentPlanets, prominentAspects);
  const { paragraph: musicalParagraph, bullets: musicalBullets } = buildMusicalNarrative(
    signatures,
    psychology,
    music,
    spec.seed,
    profile
  );
  let musicalText = musicalParagraph;

  const debugExplain = typeof process !== 'undefined' && process.env?.DEBUG_EXPLAINER === '1';
  const paraSep = '\n\n';
  if (factorMap?.factors?.length) {
    const factorLines = factorMap.factors.slice(0, 4);
    const astroLines = factorLines.map((f) => f.astro).filter((s) => !signaturesText.includes(s));
    const psychLines = factorLines.map((f) => f.psych).filter((s) => !significanceText.includes(s));
    const musicLines = factorLines.map((f) => f.music).filter((s) => !musicalText.includes(s));
    const sentinel = debugExplain ? '\n\n[correspondences]\n' : '';
    if (astroLines.length) signaturesText += sentinel + paraSep + astroLines.join(paraSep);
    if (psychLines.length) significanceText += sentinel + paraSep + psychLines.join(paraSep);
    if (musicLines.length) musicalText += sentinel + paraSep + musicLines.join(paraSep);
  }

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
// Section 1: Astrological Signatures (chart only; placements, angles, aspects)

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
  fire: 'initiative and warmth',
  earth: 'substance and form',
  air: 'idea and exchange',
  water: 'feeling and flow'
};

/** Modality as quality of expression. */
const MODALITY_FIELD: Record<string, string> = {
  cardinal: 'forward momentum and initiation',
  fixed: 'focus and persistence',
  mutable: 'adaptation and flow'
};

/** House topic (short) for placement meaning. */
const HOUSE_TOPIC: Record<number, string> = {
  1: 'self and approach to life',
  2: 'resources and values',
  3: 'communication and local exchange',
  4: 'home, roots, and private life',
  5: 'creativity and expression',
  6: 'service and routine',
  7: 'partnership and the other',
  8: 'transformation and depth',
  9: 'meaning and the larger picture',
  10: 'career and public role',
  11: 'groups and ideals',
  12: 'the unconscious and release'
};

/** One-line placement meaning: planet in sign + house topic. */
function placementMeaning(p: AstroProfile['planets'][0]): string {
  const op = PLANET_OPERATOR[p.name] ?? 'influence';
  const topic = HOUSE_TOPIC[p.house] ?? 'the chart';
  const angleNote = p.nearAngle ? `, accenting the ${p.nearAngle},` : '';
  return `${op}${angleNote} expressed through ${topic}.`;
}

/** Ordinal for house (1st, 2nd, ...). */
function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'th';
  const s = ['th', 'st', 'nd', 'rd'];
  return n + (s[v % 10] ?? 'th');
}

const FIRE_SIGNS = ['Aries', 'Leo', 'Sagittarius'];
const WATER_SIGNS = ['Cancer', 'Scorpio', 'Pisces'];
const AIR_SIGNS = ['Gemini', 'Libra', 'Aquarius'];

/** ASC sign to framing phrase. */
function ascFraming(sign: string): string {
  const el = FIRE_SIGNS.includes(sign) ? 'warmth and visibility' : WATER_SIGNS.includes(sign) ? 'depth and feeling' : AIR_SIGNS.includes(sign) ? 'exchange and idea' : 'substance and form';
  return `frames the approach to life through ${el} and self-presentation.`;
}

/** Aspect type to short descriptor for sentence. */
const ASPECT_DESC: Record<string, string> = {
  conjunction: 'conjunction',
  sextile: 'sextile',
  square: 'square',
  trine: 'trine',
  opposition: 'opposition'
};

function buildAstrologicalNarrative(
  signatures: SignatureFacts,
  _seed: string,
  profile?: AstroProfile,
  prominentPlanets?: AstroProfile['planets'],
  prominentAspects?: AstroProfile['aspects']
): string {
  const sentences: string[] = [];

  if (profile && prominentPlanets && prominentPlanets.length > 0) {
    const emp = profile.emphasis;
    const topEl = (['fire', 'earth', 'air', 'water'] as const).sort((a, b) => emp.elementsBySign[b] - emp.elementsBySign[a])[0];
    const topMod = (['cardinal', 'fixed', 'mutable'] as const).sort((a, b) => emp.modalitiesBySign[b] - emp.modalitiesBySign[a])[0];
    const elLabel = ELEMENT_FIELD[topEl] ?? 'balance';
    const modLabel = MODALITY_FIELD[topMod] ?? 'expression';
    sentences.push(`The chart's sign-based element emphasis leans ${topEl} (${elLabel}) with ${topMod} modality (${modLabel}).`);

    const seen = new Set<string>();
    for (const p of prominentPlanets.slice(0, 5)) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      const houseOrd = ordinal(p.house);
      const meaning = placementMeaning(p);
      sentences.push(`${p.name} in ${p.sign} in the ${houseOrd} house emphasizes ${meaning}`);
    }

    sentences.push(`ASC in ${profile.angles.ASC.sign} ${ascFraming(profile.angles.ASC.sign)}.`);

    if (prominentAspects && prominentAspects.length > 0) {
      for (const a of prominentAspects.slice(0, 2)) {
        const tightWord = a.tightness === 'tight' ? 'tight' : a.tightness === 'med' ? 'moderate' : 'wide';
        const orbStr = a.orb.toFixed(1);
        const typeStr = ASPECT_DESC[a.type] ?? a.type;
        const hard = a.type === 'square' || a.type === 'opposition';
        sentences.push(`A ${tightWord} ${a.a} ${typeStr} ${a.b} (orb ${orbStr}°) ${hard ? 'brings tension and activation between the planets involved.' : 'supports coherence between the planets involved.'}`);
      }
    }
  } else {
    const sorted = Object.entries(signatures.elementBlend).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const topName = top[0];
    const field = ELEMENT_FIELD[topName] ?? 'a balanced elemental field';
    sentences.push(`The chart holds a field of ${field}.`);
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
      const tensionPhrase = signatures.tensionBucket === 'high' ? 'Tension in the chart is pronounced' : signatures.tensionBucket === 'med' ? 'Tension is moderate' : 'Tension is low';
      const clusterPhrase = signatures.clusteringBucket === 'high' ? 'with strong clustering of energies' : signatures.clusteringBucket === 'med' ? 'with moderate clustering' : 'with diffuse emphasis';
      sentences.push(`${tensionPhrase}, ${clusterPhrase}.`);
    }
  }

  return sentences.slice(0, 8).join(' ');
}

// ============================================================================
// Section 2: Personal Significance (astrology → psychology; "because" clause)

/** Short psychological translation for planet-in-house (2–3 used). */
function placementPsych(p: AstroProfile['planets'][0]): string {
  const house = p.house;
  if (house === 4) return 'a need to regulate through privacy and familiarity';
  if (house === 7) return 'relating and balance showing up in partnership and one-to-one dynamics';
  if (house === 10) return 'public role and responsibility shaping how identity is expressed';
  if (house === 1) return 'self-presentation and approach to life colored by this influence';
  if (house <= 3) return 'early-life and communicative patterns reflecting this energy';
  if (house <= 6) return 'daily life and habits carrying this signature';
  if (house <= 9) return 'meaning-making and depth informed by this placement';
  return 'collective and inner life reflecting this influence';
}

function buildPsychologicalNarrative(
  signatures: SignatureFacts,
  psychology: PsychologyFacts,
  _seed: string,
  profile?: AstroProfile,
  prominentPlanets?: AstroProfile['planets'],
  prominentAspects?: AstroProfile['aspects']
): string {
  const paragraphs: string[] = [];

  if (profile && prominentPlanets && prominentPlanets.length > 0) {
    for (const p of prominentPlanets.slice(0, 3)) {
      const psych = placementPsych(p);
      paragraphs.push(`Psychologically, ${p.name} in the ${ordinal(p.house)} house can show up as ${psych}.`);
    }
    if (prominentAspects && prominentAspects.length > 0) {
      const a = prominentAspects[0];
      const tensionNote = a.type === 'square' || a.type === 'opposition'
        ? 'The tension between these planets often shows up as internal friction that can be channeled into focus and growth.'
        : 'The supportive link between these planets tends to show up as ease in integrating identity and emotional life.';
      paragraphs.push(tensionNote);
    }
    paragraphs.push(`Attention tends toward ${psychology.attentionStyle} focus, with ${psychology.pacing} pacing and ${psychology.relatingStyle} relating.`);
  } else {
    const top = Object.entries(signatures.elementBlend).sort((a, b) => b[1] - a[1])[0];
    const planet = signatures.dominantPlanets[0];
    const planetPhrase = planet ? `${planet} ` : '';
    paragraphs.push(`Because the ${top[0]} element and ${planetPhrase}influence shape how tension and repetition are held, temperament leans toward ${psychology.temperamentWords.join(' and ')}.`);
    paragraphs.push(`Attention tends toward ${psychology.attentionStyle} focus, with ${psychology.pacing} pacing and ${psychology.relatingStyle} relating.`);
  }

  const disclaimer = '\n\nThis is a personality-style reading mapped into musical decisions, not a prediction.';
  return paragraphs.join(' ') + disclaimer;
}

// ============================================================================
// Section 3: Musical Identity and Flow (mirrors prior sections; listening-cue bullets)

function buildMusicalNarrative(
  _signatures: SignatureFacts,
  _psychology: PsychologyFacts,
  music: MusicFacts,
  _seed: string,
  profile?: AstroProfile
): { paragraph: string; bullets: string[] } {
  const sentences: string[] = [];

  if (profile) {
    const emp = profile.emphasis;
    const topEl = (['fire', 'earth', 'air', 'water'] as const).sort((a, b) => emp.elementsBySign[b] - emp.elementsBySign[a])[0];
    const topMod = (['cardinal', 'fixed', 'mutable'] as const).sort((a, b) => emp.modalitiesBySign[b] - emp.modalitiesBySign[a])[0];
    const mirrorLead =
      topEl === 'fire' && (topMod === 'cardinal' || topMod === 'mutable')
        ? 'Because the chart\'s sign-based emphasis is fire and ' + topMod + ', the piece favors forward motion and clearer attacks.'
        : topEl === 'earth' || topMod === 'fixed'
          ? 'Because the chart emphasizes substance and focus, the piece anchors around steady pulse and harmonic grounding.'
          : topEl === 'water' || topEl === 'air'
            ? 'Because the chart emphasizes flow and exchange, the piece favors continuity and register movement.'
            : 'The composition mirrors these patterns in sound.';
    sentences.push(mirrorLead);
    sentences.push(
      `A ${music.bpm} BPM pulse and ${music.densityBucket} texture, with register leaning ${music.registerBias}, reflect the chart's angles and prominence.`
    );
    sentences.push(
      `Motion is ${music.motionBucket}, articulation ${music.articulationBucket}; harmony holds a ${music.harmonicPosture} stance, mirroring aspect tension and support.`
    );
    sentences.push(
      `${music.arcSummary.begin}. ${music.arcSummary.middle}. ${music.arcSummary.end}.`
    );
  } else {
    sentences.push(
      `The composition mirrors these patterns in sound: a ${music.bpm} BPM pulse and ${music.densityBucket} texture, with register leaning ${music.registerBias}.`
    );
    sentences.push(
      `Motion is ${music.motionBucket}, articulation ${music.articulationBucket}; harmony holds a ${music.harmonicPosture} stance.`
    );
    sentences.push(
      `${music.arcSummary.begin}. ${music.arcSummary.middle}. ${music.arcSummary.end}.`
    );
  }

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
