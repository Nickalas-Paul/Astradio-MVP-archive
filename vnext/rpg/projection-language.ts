import type { CampaignState, NatalBodyModifier, OutcomeDirection, TransitPressure } from './types';

const DOMAIN_LABELS: Record<string, string> = {
  self: 'your sense of self and direction',
  assets: 'resources, values, and material footing',
  communication: 'communication, interpretation, and immediate exchanges',
  home: 'home, roots, and foundations',
  creativity: 'expression, desire, and creative risk',
  work: 'work, responsibility, and daily systems',
  partnership: 'relationships, reciprocity, and shared expectations',
  transformation: 'trust, exchange, and deeper entanglements',
  belief: 'conviction, horizon, and meaning-making',
  career: 'role, reputation, and visible responsibility',
  community: 'belonging, contribution, and social position',
  subconscious: 'inner weather, fatigue, and quieter undercurrents',
};

const DOMAIN_CONTEXTS: Record<string, string> = {
  self: 'how you define yourself in motion',
  assets: 'how you handle value and practical steadiness',
  communication: 'how you phrase, signal, and interpret',
  home: 'how you hold foundations and private needs',
  creativity: 'how you risk expression or devotion',
  work: 'how you organize effort and obligations',
  partnership: 'how you meet another person or expectation',
  transformation: 'how you handle trust, stakes, and exchange',
  belief: 'how you orient around meaning and direction',
  career: 'how you carry role and visibility',
  community: 'how you participate in group life',
  subconscious: 'how you respond before everything is fully conscious',
};

const ASPECT_PRESSURE: Record<string, string> = {
  conjunction: 'brings the issue close and immediate',
  opposition: 'pulls attention across competing demands',
  square: 'creates friction that asks for adjustment',
  trine: 'opens a smoother path for movement',
  sextile: 'offers a workable opening if you engage it',
};

const POLARITY_LANGUAGE: Record<string, { tone: string; tradeoff: string; implication: string }> = {
  constructive: {
    tone: 'more open than blocked',
    tradeoff: 'it can still drift if you assume ease will carry it on its own',
    implication: 'supports movement without forcing it',
  },
  frictional: {
    tone: 'sharp enough to expose strain',
    tradeoff: 'it can harden quickly if met too bluntly',
    implication: 'clarifies where pressure is asking for adjustment',
  },
  volatile: {
    tone: 'changeable enough to amplify quickly',
    tradeoff: 'timing matters because escalation is easier here',
    implication: 'makes pacing more important than force',
  },
  binding: {
    tone: 'sticky enough to slow easy resolution',
    tradeoff: 'it can hold you in place longer than expected',
    implication: 'asks for patience and narrower moves',
  },
};

const INTENSITY_LANGUAGE: Record<TransitPressure['intensityBand'], { urgency: string; qualifier: string }> = {
  low: { urgency: 'in the background', qualifier: 'lightly' },
  moderate: { urgency: 'clearly active', qualifier: 'noticeably' },
  high: { urgency: 'insistent today', qualifier: 'strongly' },
  critical: { urgency: 'difficult to ignore', qualifier: 'intensely' },
};

const MODIFIER_LANGUAGE: Record<NatalBodyModifier, string> = {
  core: 'identity and self-definition',
  felt: 'emotional processing and sensitivity',
  interpretive: 'meaning-making and narrative framing',
  relational: 'reciprocity, care, and mutual response',
  volitional: 'agency, desire, and direct effort',
  expansive: 'possibility, scale, and future-facing belief',
  structural: 'limits, obligations, and durable form',
  disruptive: 'instability, surprise, and deviation from routine',
  diffuse: 'uncertainty, porousness, and blurred edges',
  depth: 'stakes, consequence, and buried material',
  tender: 'vulnerability and careful handling',
};

const HOUSE_LANGUAGE: Record<number, string> = {
  1: 'your visible stance and self-presentation',
  2: 'your resources and practical steadiness',
  3: 'your words, signals, and immediate exchanges',
  4: 'your private foundations and roots',
  5: 'your expression, desire, and creative courage',
  6: 'your labor, health, and repeatable systems',
  7: 'your expectations with others',
  8: 'shared stakes, trust, and exchange',
  9: 'your horizon, beliefs, and longer view',
  10: 'your role, responsibility, and public visibility',
  11: 'your alliances, networks, and shared belonging',
  12: 'your inner processing and harder-to-name material',
};

const TONE_CONTINUITY: Record<string, string> = {
  neutral: '',
  clarity: 'Recent turns have leaned toward naming things plainly and defining the line more clearly.',
  momentum: 'Recent turns have leaned toward movement, follow-through, and keeping things in motion.',
  ambiguity: 'Recent turns have leaned toward holding space without forcing quick resolution.',
  containment: 'Recent turns have leaned toward protecting capacity and reducing unnecessary exposure.',
  cohesion: 'Recent turns have leaned toward connection, trust, and relational steadiness.',
  repair: 'Recent turns have leaned toward repair, reciprocity, and small acts that restore trust.',
  integration: 'Recent turns have leaned toward making a more coherent story out of mixed signals.',
  stability: 'Recent turns have leaned toward limits, steadier pacing, and preserving structure.',
  strain: 'Recent turns have carried extra strain, so narrower moves may read more clearly than sweeping ones.',
};

const HISTORY_DIRECTION_TEXT: Record<string, string> = {
  assert_define: 'It also echoes a recent pattern of defining the situation rather than leaving it implied.',
  engage_advance: 'It also continues a recent pattern of moving things forward through action.',
  observe_hold: 'It also echoes a recent pattern of leaving room before forcing an answer.',
  withdraw_protect: 'It also continues a recent pattern of protecting capacity by reducing exposure.',
  support_connect: 'It also echoes a recent pattern of bringing in connection or perspective.',
  offer_restore: 'It also continues a recent pattern of repair through something concrete.',
  reframe_integrate: 'It also echoes a recent pattern of changing interpretation before changing the outer move.',
  contain_limit: 'It also continues a recent pattern of narrowing scope to stabilize what matters most.',
};

const OUTCOME_EFFECTS: Record<OutcomeDirection, string> = {
  assert_define: 'strengthen clarity and definition',
  engage_advance: 'increase movement and agency',
  observe_hold: 'preserve optionality while delaying commitment',
  withdraw_protect: 'reduce exposure and protect capacity',
  support_connect: 'strengthen trust, perspective, or alliance',
  offer_restore: 'support repair and reciprocity',
  reframe_integrate: 'increase coherence and flexibility',
  contain_limit: 'stabilize capacity by narrowing scope',
};

const OUTCOME_TRADEOFFS: Record<OutcomeDirection, string> = {
  assert_define: 'it can raise friction before the situation settles',
  engage_advance: 'it can outrun the conditions if momentum becomes the only priority',
  observe_hold: 'it may leave uncertainty in place for longer',
  withdraw_protect: 'it may slow contact or visible progress',
  support_connect: 'it may reduce solitary momentum while perspective catches up',
  offer_restore: 'it may overextend you if reciprocity is not actually available',
  reframe_integrate: 'it may delay action if interpretation becomes a substitute for movement',
  contain_limit: 'it may create distance if the limit lands too rigidly',
};

export function stableVariant(seed: string, variants: string[]): string {
  if (variants.length === 0) return '';
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return variants[hash % variants.length] ?? variants[0] ?? '';
}

export function compactText(text: string): string {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function firstSentence(text: string): string {
  const compact = compactText(text);
  if (!compact) return '';
  const match = compact.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] ?? compact).trim();
}

export function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? 'the active area of life';
}

export function domainContext(domain: string): string {
  return DOMAIN_CONTEXTS[domain] ?? 'how you meet the active situation';
}

export function aspectPressure(aspectType: string): string {
  return ASPECT_PRESSURE[aspectType] ?? 'changes the pressure pattern in a noticeable way';
}

export function polarityTone(polarity?: string): string {
  return POLARITY_LANGUAGE[polarity ?? 'frictional']?.tone ?? POLARITY_LANGUAGE.frictional.tone;
}

export function polarityTradeoff(polarity?: string): string {
  return POLARITY_LANGUAGE[polarity ?? 'frictional']?.tradeoff ?? POLARITY_LANGUAGE.frictional.tradeoff;
}

export function polarityImplication(polarity?: string): string {
  return POLARITY_LANGUAGE[polarity ?? 'frictional']?.implication ?? POLARITY_LANGUAGE.frictional.implication;
}

export function intensityUrgency(intensityBand: TransitPressure['intensityBand'] | undefined): string {
  return INTENSITY_LANGUAGE[intensityBand ?? 'moderate']?.urgency ?? INTENSITY_LANGUAGE.moderate.urgency;
}

export function intensityQualifier(intensityBand: TransitPressure['intensityBand'] | undefined): string {
  return INTENSITY_LANGUAGE[intensityBand ?? 'moderate']?.qualifier ?? INTENSITY_LANGUAGE.moderate.qualifier;
}

export function modifierLanguage(modifier?: NatalBodyModifier): string {
  return MODIFIER_LANGUAGE[modifier ?? 'tender'] ?? MODIFIER_LANGUAGE.tender;
}

export function houseLanguage(house?: number): string {
  return HOUSE_LANGUAGE[house ?? 12] ?? 'the part of life carrying the pressure most directly';
}

export function dominantToneKey(state: CampaignState): string {
  const entries = Object.entries(state.tone_track ?? {});
  if (entries.length === 0) return 'neutral';
  return entries
    .slice()
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'neutral';
}

function aggregateDomainTrack(state: CampaignState): Array<[string, number]> {
  const totals = new Map<string, number>();
  for (const [key, value] of Object.entries(state.domain_track ?? {})) {
    const match = /^domain:([a-z_]+):/.exec(key);
    const domain = match?.[1] ?? key;
    totals.set(domain, (totals.get(domain) ?? 0) + value);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function topDomainKey(state: CampaignState): string | null {
  return aggregateDomainTrack(state)[0]?.[0] ?? null;
}

export function continuityLines(state: CampaignState, domain: string): string[] {
  const lines: string[] = [];
  const toneKey = dominantToneKey(state);
  const domainKey = topDomainKey(state);
  const toneLine = TONE_CONTINUITY[toneKey];
  if (toneLine) lines.push(toneLine);
  if (domainKey === domain) {
    lines.push(`This continues a recent concentration around ${domainLabel(domain)}.`);
  }
  const history = Array.isArray(state.history) ? state.history : [];
  const latest = history[history.length - 1];
  const historyMatch = /^h:[a-z_]+:([a-z_]+_[a-z_]+):([a-z_]+)$/.exec(latest ?? '');
  if (historyMatch && historyMatch[2] === domain) {
    const line = HISTORY_DIRECTION_TEXT[historyMatch[1]];
    if (line) lines.push(line);
  }
  return lines.slice(0, 2);
}

export function outcomeSentence(direction: OutcomeDirection, domain: string): string {
  const effect = OUTCOME_EFFECTS[direction];
  const tradeoff = OUTCOME_TRADEOFFS[direction];
  return `This tends to ${effect} in ${domainLabel(domain)}, while ${tradeoff}.`;
}
