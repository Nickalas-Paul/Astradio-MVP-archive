/**
 * Server-side fantasy class display for Campaign narrative prompts.
 * Names/roles mirror apps/web + apps/mobile CLASS_MAP (player-visible sheet).
 * Strengths/shadows are narrative-only enrichment for Gemini/fallback copy.
 */

import type { StatBlock, StatKey } from './types';

export interface ClassDisplayInfo {
  sign: string;
  name: string;
  element: string;
  modality: string;
  role: string;
  strengths: string;
  shadow: string;
}

export interface CharacterIdentityContext {
  className: string;
  classElement: string;
  classRole: string;
  classStrengths: string;
  classShadow: string;
  subclassName: string;
  subclassElement: string;
  risingName: string;
  risingElement: string;
  strongestStat: { name: string; value: number };
  weakestStat: { name: string; value: number };
  statProfile: string;
}

const STAT_KEYS: readonly StatKey[] = [
  'vitality',
  'resilience',
  'cunning',
  'charm',
  'intuition',
  'willpower',
];

/** Client-matched fantasy names + roles; strengths/shadow for narration. */
export const CLASS_MAP: Readonly<Record<string, ClassDisplayInfo>> = {
  aries: {
    sign: 'aries',
    name: 'Flamecaller',
    element: 'fire',
    modality: 'cardinal',
    role: 'Aggressive striker, initiator',
    strengths: 'initiative, courage, decisive action',
    shadow: 'impatience, recklessness, burning bridges',
  },
  taurus: {
    sign: 'taurus',
    name: 'Stonebinder',
    element: 'earth',
    modality: 'fixed',
    role: 'Resilient tank, resource hoarder',
    strengths: 'endurance, patience, material mastery',
    shadow: 'stubbornness, resistance to change, hoarding',
  },
  gemini: {
    sign: 'gemini',
    name: 'Spelltwister',
    element: 'air',
    modality: 'mutable',
    role: 'Fast dual-caster, chaos manipulator',
    strengths: 'adaptability, communication, quick thinking',
    shadow: 'scattered focus, superficiality, restlessness',
  },
  cancer: {
    sign: 'cancer',
    name: 'Tidemage',
    element: 'water',
    modality: 'cardinal',
    role: 'Protective healer, emotion-based power',
    strengths: 'emotional intelligence, protection, nurturing',
    shadow: 'defensiveness, clinginess, indirect confrontation',
  },
  leo: {
    sign: 'leo',
    name: 'Radiant',
    element: 'fire',
    modality: 'fixed',
    role: 'Charismatic leader, self-buffing paladin',
    strengths: 'confidence, generosity, creative leadership',
    shadow: 'pride, need for validation, dominating',
  },
  virgo: {
    sign: 'virgo',
    name: 'Mindweaver',
    element: 'earth',
    modality: 'mutable',
    role: 'Tactical debuffer, precision magic',
    strengths: 'precision, service, analytical clarity',
    shadow: 'perfectionism, overcritical, anxiety',
  },
  libra: {
    sign: 'libra',
    name: 'Mirrorblade',
    element: 'air',
    modality: 'cardinal',
    role: 'Balanced duelist, charm-based fighter',
    strengths: 'diplomacy, fairness, relational intelligence',
    shadow: 'indecision, people-pleasing, conflict avoidance',
  },
  scorpio: {
    sign: 'scorpio',
    name: 'Soulpiercer',
    element: 'water',
    modality: 'fixed',
    role: 'Shadow assassin, emotional control',
    strengths: 'depth, intensity, transformative power',
    shadow: 'obsession, control, destructive fixation',
  },
  sagittarius: {
    sign: 'sagittarius',
    name: 'Starforger',
    element: 'fire',
    modality: 'mutable',
    role: 'Long-range chaos archer, travel-based skills',
    strengths: 'vision, optimism, philosophical reach',
    shadow: 'overextension, bluntness, restless escapism',
  },
  capricorn: {
    sign: 'capricorn',
    name: 'Ironwright',
    element: 'earth',
    modality: 'cardinal',
    role: 'Fortress builder, enduring strategist',
    strengths: 'discipline, strategic patience, authority',
    shadow: 'rigidity, workaholism, emotional suppression',
  },
  aquarius: {
    sign: 'aquarius',
    name: 'Stormsinger',
    element: 'air',
    modality: 'fixed',
    role: 'Inventive spellcaster, anti-structure',
    strengths: 'innovation, independence, systemic thinking',
    shadow: 'detachment, contrarianism, emotional distance',
  },
  pisces: {
    sign: 'pisces',
    name: 'Dreamdancer',
    element: 'water',
    modality: 'mutable',
    role: 'Illusionist, dreamwalker, spiritual buffer',
    strengths: 'empathy, imagination, spiritual sensitivity',
    shadow: 'boundary dissolution, escapism, overwhelm',
  },
};

const FALLBACK: ClassDisplayInfo = {
  sign: 'unknown',
  name: 'Wanderer',
  element: 'earth',
  modality: 'fixed',
  role: 'Adventurer',
  strengths: 'adaptability and resolve',
  shadow: 'uncertainty under pressure',
};

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function normalizeSignSlug(input: string): string {
  return String(input || '')
    .toLowerCase()
    .replace(/^(class_|subclass_|rising_)/, '')
    .trim();
}

export function getClassInfo(slug: string): ClassDisplayInfo {
  const sign = normalizeSignSlug(slug);
  return CLASS_MAP[sign] ?? { ...FALLBACK, sign: sign || 'unknown', name: titleCase(sign) || 'Wanderer' };
}

function rankedStats(statBlock: StatBlock): Array<{ key: StatKey; name: string; value: number }> {
  return STAT_KEYS.map((key) => ({
    key,
    name: titleCase(key),
    value: typeof statBlock[key] === 'number' ? statBlock[key] : 0,
  })).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

export function resolveCharacterIdentity(
  classSlug: string,
  subclassSlug: string,
  risingSlug: string,
  statBlock: StatBlock
): CharacterIdentityContext {
  const cls = getClassInfo(classSlug);
  const sub = getClassInfo(subclassSlug);
  const rising = getClassInfo(risingSlug);
  const ranked = rankedStats(statBlock);
  const strongest = ranked[0]!;
  const weakest = ranked[ranked.length - 1]!;

  return {
    className: cls.name,
    classElement: cls.element,
    classRole: cls.role,
    classStrengths: cls.strengths,
    classShadow: cls.shadow,
    subclassName: sub.name,
    subclassElement: sub.element,
    risingName: rising.name,
    risingElement: rising.element,
    strongestStat: { name: strongest.name, value: strongest.value },
    weakestStat: { name: weakest.name, value: weakest.value },
    statProfile: `strongest in ${strongest.name} (${strongest.value}), weakest in ${weakest.name} (${weakest.value})`,
  };
}

/** Whether a stat key ranks in the top 2 or bottom 2 of the block. */
export function classifyStatStrength(
  statBlock: StatBlock,
  statKey: StatKey
): { isStrength: boolean; isWeakness: boolean } {
  const ranked = rankedStats(statBlock);
  const top = new Set(ranked.slice(0, 2).map((r) => r.key));
  const bottom = new Set(ranked.slice(-2).map((r) => r.key));
  return {
    isStrength: top.has(statKey),
    isWeakness: bottom.has(statKey),
  };
}

export function titleCaseStatKey(statKey: string): string {
  return titleCase(String(statKey || '').toLowerCase());
}
