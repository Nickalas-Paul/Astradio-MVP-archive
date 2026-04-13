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
import {
  densityBandCodeFromExplainerBucket,
  mapDensity,
  mapTempo,
  tempoBandCodeFromExplainerBpm,
  withTerminalPeriod,
} from '../../projection/rule-layer/audio-lexicon';

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
    const psychLines = factorLines
      .map((f) => normalizeFactorPsychLine(f.psych))
      .filter((s) => !significanceText.includes(s));
    const musicLines = factorLines
      .map((f) => normalizeFactorMusicLine(f.music))
      .filter((s) => !musicalText.includes(s));
    const sentinel = debugExplain ? '\n\n[correspondences]\n' : '';
    if (astroLines.length) signaturesText += sentinel + paraSep + astroLines.join(paraSep);
    if (psychLines.length) significanceText += sentinel + paraSep + psychLines.join(paraSep);
    if (musicLines.length) musicalText += sentinel + paraSep + musicLines.join(paraSep);
  }

  // Safeguard: ensure signatures section is never silently empty when we have usable SignatureFacts.
  // If the narrative builder produced no text, fall back to a minimal, deterministic summary
  // derived from element blend and buckets (tension/clustering).
  if (!signaturesText.trim()) {
    const blend = signatures.elementBlend;
    const parts: string[] = [];
    const entries = [
      { key: 'fire', value: blend.fire },
      { key: 'earth', value: blend.earth },
      { key: 'air', value: blend.air },
      { key: 'water', value: blend.water },
    ];
    entries.sort((a, b) => b.value - a.value);
    const primary = entries[0];
    if (primary && primary.value > 0) {
      parts.push(`Elementally, the chart leans ${primary.key} in its overall field.`);
    }
    const tension = signatures.tensionBucket;
    const clustering = signatures.clusteringBucket;
    const tensionPhrase =
      tension === 'high' ? 'pronounced tension signals' :
      tension === 'med' ? 'a moderate level of tension' :
      'a relatively low-tension profile';
    const clusterPhrase =
      clustering === 'high' ? 'a tightly clustered pattern of placements' :
      clustering === 'med' ? 'a mixed pattern of clustering and spread' :
      'a more spread-out distribution of placements';
    parts.push(`Structurally, ${tensionPhrase} combine with ${clusterPhrase}.`);

    signaturesText = parts.join(' ');
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
    const elKeys: Array<keyof typeof emp.elementsBySign> = ['fire', 'earth', 'air', 'water'];
    const modKeys: Array<keyof typeof emp.modalitiesBySign> = ['cardinal', 'fixed', 'mutable'];
    const topEl = elKeys.sort((a, b) => emp.elementsBySign[b] - emp.elementsBySign[a])[0];
    const topMod = modKeys.sort((a, b) => emp.modalitiesBySign[b] - emp.modalitiesBySign[a])[0];
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
  const emitted = new Set<string>();
  const paragraphs: string[] = [];

  if (profile && prominentPlanets && prominentPlanets.length > 0) {
    const picks = prominentPlanets.slice(0, Math.min(4, prominentPlanets.length));
    const p1 = picks[0];
    const p2 = picks[1] ?? picks[0];
    const p3 = picks[2] ?? picks[1] ?? picks[0];
    const p4 = picks[3];

    const para1: string[] = [];
    para1.push(...psychSentencesForPlacement(p1));
    if (p2 && p2.name !== p1.name) para1.push(...psychSentencesForPlacement(p2));
    if (p3 && p3.name !== p2?.name && p3.name !== p1.name) para1.push(...psychSentencesForPlacement(p3));

    // Aspect bridge (only if present)
    if (prominentAspects && prominentAspects.length > 0) {
      const a = prominentAspects[0];
      para1.push(psychSentenceForAspect(a));
    }

    paragraphs.push(emitParagraph(para1, emitted));

    // Second paragraph: grounded synthesis + extra placement to meet "2–3 placements" per paragraph
    const para2: string[] = [];
    if (p4) para2.push(...psychSentencesForPlacement(p4));
    // Reuse a different placement for anchoring the attention/pacing sentence without duplicating prior wording.
    para2.push(psychSentenceForAttentionStyle(psychology, [p1, p2, p3, p4].filter(Boolean) as AstroProfile['planets']));
    paragraphs.push(emitParagraph(para2, emitted));
  } else {
    const top = Object.entries(signatures.elementBlend).sort((a, b) => b[1] - a[1])[0];
    const planet = signatures.dominantPlanets[0];
    const temperament = psychology.temperamentWords.join(' and ');
    const para: string[] = [];
    para.push(
      `A ${top[0]}-leaning chart paired with ${planet ?? 'a dominant planet'} often reads as ${temperament} in day-to-day decision-making.`
    );
    para.push(`Focus tends to be ${psychology.attentionStyle} rather than diffuse when a task feels meaningful.`);
    para.push(`Pacing stays ${psychology.pacing} under pressure, and connection is usually ${psychology.relatingStyle} instead of performative.`);
    paragraphs.push(emitParagraph(para, emitted));
  }

  const disclaimer = '\n\nThis is a personality-style reading mapped into musical decisions, not a prediction.';
  return dedupeSentences(paragraphs.filter(Boolean).join('\n\n') + disclaimer);
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
  const emitted = new Set<string>();

  // Paragraph structure:
  // 1) single-sentence causal link
  // 2) technical specifics (introduced once)
  // 3) synthesis back to psychology
  const sentences: string[] = [];
  if (profile) {
    const emp = profile.emphasis;
    const elKeys: Array<keyof typeof emp.elementsBySign> = ['fire', 'earth', 'air', 'water'];
    const modKeys: Array<keyof typeof emp.modalitiesBySign> = ['cardinal', 'fixed', 'mutable'];
    const topEl = elKeys.sort((a, b) => emp.elementsBySign[b] - emp.elementsBySign[a])[0];
    const topMod = modKeys.sort((a, b) => emp.modalitiesBySign[b] - emp.modalitiesBySign[a])[0];
    const aspectTone = profile.aspects?.some(a => a.type === 'square' || a.type === 'opposition') ? 'tension' : 'support';
    sentences.push(emitSentence(musicCausalLead(topEl, topMod, aspectTone), emitted));
  } else {
    sentences.push(
      emitSentence(
        `Element balance and aspect geometry align with this density read: ${withTerminalPeriod(
          mapDensity(densityBandCodeFromExplainerBucket(music.densityBucket))
        )}`,
        emitted
      )
    );
  }

  sentences.push(
    emitSentence(
      `Tempo sits at ${music.bpm} BPM with ${music.densityBucket} density, a ${music.registerBias}-leaning register, and ${music.harmonicPosture} harmony.`,
      emitted
    )
  );

  // Collapse motion + articulation into one sentence if they would read redundant.
  sentences.push(emitSentence(musicMotionArticulationSentence(music.motionBucket, music.articulationBucket), emitted));

  sentences.push(
    emitSentence(
      `Arc: ${music.arcSummary.begin}; ${music.arcSummary.middle}; ${music.arcSummary.end}.`,
      emitted
    )
  );

  sentences.push(
    emitSentence(
      `The steadiness of the pulse and the way the arc resolves tend to echo a psychological pattern of ${safePhrase(music.motionBucket)} movement paired with ${safePhrase(music.articulationBucket)} response.`,
      emitted
    )
  );

  const paragraph = dedupeSentences(sentences.filter(Boolean).join(' '));

  const bullets: string[] = [];
  bullets.push(`${music.bpm} BPM anchors the chart in the spec.`);
  bullets.push(
    withTerminalPeriod(mapTempo(tempoBandCodeFromExplainerBpm(music.bpm)))
  );
  bullets.push(`Listen for stepwise contour when motion is ${music.motionBucket}, and expect larger interval jumps when it is high.`);
  bullets.push(`Track where melodies sit most often; a ${music.registerBias} bias changes how weight and brightness feel.`);
  bullets.push(
    `${withTerminalPeriod(mapDensity(densityBandCodeFromExplainerBucket(music.densityBucket)))} (spec density bucket: ${music.densityBucket}.)`
  );
  if (music.planSummary?.avgMelodicInterval != null) {
    bullets.push(
      `When the melody moves, compare steps to leaps; the average interval hovers around ${music.planSummary.avgMelodicInterval.toFixed(0)} semitones.`
    );
  }
  bullets.push(`Notice whether harmony stays ${music.harmonicPosture} by returning to a clear root or by shifting color without fully settling.`);

  const unique = Array.from(new Set(bullets.map(b => b.trim()))).filter(Boolean).slice(0, 6);
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
    significance: stripBannedFiller(dedupeSentences(sigText)),
    musical: stripBannedFiller(dedupeSentences(musText)),
    bullets: dedupedBullets.map((b) => stripBannedFiller(dedupeSentences(b)))
  };
}

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.endsWith('.') || s.endsWith('!') || s.endsWith('?') ? s : s + '.');
}

/**
 * Remove identical or near-identical sentences while preserving order.
 * Deterministic, whitespace/punctuation tolerant, no randomness.
 */
export function dedupeSentences(text: string): string {
  const raw = extractSentences(text.replace(/\s+\n/g, '\n'));
  const out: string[] = [];
  const seen = new Set<string>();

  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    const key = sentenceFingerprint(trimmed);
    if (seen.has(key)) continue;
    // Near-duplicate guard: same first ~9 words after normalization.
    const near = sentenceNearFingerprint(trimmed);
    if (Array.from(seen).some((k) => k.startsWith(near) || near.startsWith(k))) continue;
    seen.add(key);
    out.push(trimmed);
  }

  // Preserve paragraph breaks if present in original text.
  const rebuilt = out.join(' ');
  return rebuilt.replace(/\s+\./g, '.').trim();
}

function sentenceFingerprint(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceNearFingerprint(s: string): string {
  const words = sentenceFingerprint(s).split(' ').filter(Boolean);
  return words.slice(0, 9).join(' ');
}

function emitSentence(sentence: string, emitted: Set<string>): string {
  const s = sentence.trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const key = sentenceFingerprint(s);
  if (emitted.has(key)) return '';
  emitted.add(key);
  return s.endsWith('.') ? s : s + '.';
}

function emitParagraph(lines: string[], emitted: Set<string>): string {
  const cleaned = lines
    .map((s) => emitSentence(s, emitted))
    .filter(Boolean)
    .join(' ')
    .trim();
  return dedupeSentences(cleaned);
}

function safePhrase(bucket: string): string {
  if (bucket === 'high') return 'more';
  if (bucket === 'low') return 'less';
  return 'moderate';
}

function psychSentencesForPlacement(p: AstroProfile['planets'][0]): string[] {
  const houseOrd = ordinal(p.house);
  const base = `${p.name} in ${p.sign} in the ${houseOrd} house`;

  // One idea per sentence, grounded in behavior.
  switch (p.name) {
    case 'Moon':
      return [
        `With ${base}, emotional regulation is pulled toward the ${HOUSE_TOPIC[p.house] ?? 'themes of that house'} and processed through immediate routines rather than theory.`,
        `When feelings spike, the first move is usually to do something concrete in that life area instead of waiting it out.`
      ];
    case 'Mercury':
      return [
        `With ${base}, thinking is most fluent when it has a specific audience or practical context.`,
        `Decisions tend to be tested in conversation, notes, or iteration rather than decided once and left alone.`
      ];
    case 'Venus':
      return [
        `With ${base}, relationship comfort is built through repeated, observable gestures tied to the ${HOUSE_TOPIC[p.house] ?? 'topic of that house'}.`,
        `Preference shows up as what you maintain consistently, not what you say you like in the abstract.`
      ];
    case 'Mars':
      return [
        `With ${base}, action starts easiest when the goal is concrete and time-bounded.`,
        `Frustration often turns into fixing, training, or competing in the ${HOUSE_TOPIC[p.house] ?? 'area of that house'} rather than venting.`
      ];
    case 'Saturn':
      return [
        `With ${base}, responsibility becomes a daily practice instead of a one-time promise.`,
        `There is a strong bias toward systems and standards in the ${HOUSE_TOPIC[p.house] ?? 'area of that house'}, even when it slows you down at first.`
      ];
    case 'Sun':
      return [
        `With ${base}, identity stabilizes when you can point to real outputs inside the ${HOUSE_TOPIC[p.house] ?? 'house topic'} rather than private intention.`,
        `Confidence grows through repetition and visible competence, not hype.`
      ];
    default:
      return [
        `With ${base}, the ${PLANET_OPERATOR[p.name] ?? 'drive'} tends to operate through the ${HOUSE_TOPIC[p.house] ?? 'house topic'} in observable habits.`,
        `The pattern is easiest to spot in what you repeat when nobody is watching.`
      ];
  }
}

function psychSentenceForAspect(a: AstroProfile['aspects'][0]): string {
  const type = ASPECT_DESC[a.type] ?? a.type;
  const orbStr = a.orb.toFixed(1);
  const hard = a.type === 'square' || a.type === 'opposition';
  const frame = `${a.a} ${type} ${a.b} (orb ${orbStr}°)`;
  if (hard) {
    return `${frame} describes a recurring push-pull that often gets resolved through strategy rather than impulse.`;
  }
  return `${frame} describes an internal agreement that makes it easier to follow through without forcing it.`;
}

function psychSentenceForAttentionStyle(psychology: PsychologyFacts, anchors: AstroProfile['planets']): string {
  const a = anchors[0];
  const b = anchors[1] ?? anchors[0];
  const aRef = a ? `${a.name} in the ${ordinal(a.house)}` : 'the most prominent placements';
  const bRef = b ? `${b.name} in the ${ordinal(b.house)}` : 'the chart emphasis';
  return `Taken together, ${aRef} and ${bRef} often produce ${psychology.attentionStyle} attention, ${psychology.pacing} pacing, and ${psychology.relatingStyle} connection in real conversations.`;
}

function musicCausalLead(
  topEl: 'fire' | 'earth' | 'air' | 'water',
  topMod: 'cardinal' | 'fixed' | 'mutable',
  aspectTone: 'tension' | 'support'
): string {
  const el = topEl === 'fire' ? 'fire' : topEl === 'earth' ? 'earth' : topEl === 'air' ? 'air' : 'water';
  const mod = topMod;
  if (el === 'earth' || mod === 'fixed') return `Earth and fixed signatures lean toward weight and repeatability, so the music prioritizes stable grounding even when ${aspectTone} is present.`;
  if (el === 'fire') return `Fire combined with ${mod} expression tends to push forward, so the music favors clear attacks and directional motion without constant acceleration.`;
  if (el === 'water') return `Water emphasis invites continuity, so the music prefers connected phrasing and gradual shifts rather than abrupt resets.`;
  return `Air emphasis pulls toward variation and exchange, so the music uses contrast and register movement to keep attention engaged.`;
}

function musicMotionArticulationSentence(motion: string, articulation: string): string {
  if (motion === articulation) return `Motion and articulation both sit in the same ${motion} bucket, which makes the groove feel unified rather than conflicted.`;
  return `Motion is ${motion} while articulation is ${articulation}, creating a specific blend of contour and attack.`;
}

function normalizeFactorPsychLine(line: string): string {
  // Rewrite common scaffolding to avoid repeated "Because..." templates.
  let s = (line ?? '').trim();
  if (!s) return s;
  s = s.replace(/^Because\s+/i, '');
  s = s.replace(/\bthis tends to show up as\b/gi, 'this often shows up as');
  s = s.replace(/\b(tends to show up as)\b/gi, 'often shows up as');
  s = s.replace(/\brelating\b/gi, 'connection');
  // Ensure it reads as a standalone sentence.
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

function normalizeFactorMusicLine(line: string): string {
  // Remove repeated "In sound..." lead-ins while keeping the information.
  let s = (line ?? '').trim();
  if (!s) return s;
  s = s.replace(/^In sound,\s*this is mirrored by\s+/i, '');
  s = s.replace(/^In sound,\s*/i, '');
  s = s.replace(/\bmirrored by\b/gi, 'expressed as');
  if (!/[.!?]$/.test(s)) s += '.';
  // Avoid ending up with a fragment after stripping.
  if (s.split(/\s+/).length < 4) return line.trim().endsWith('.') ? line.trim() : line.trim() + '.';
  return s;
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
