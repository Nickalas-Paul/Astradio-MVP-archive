/**
 * Phase 8C: Guest-safe Home sky report sections.
 * Purpose-written present-tense copy — no natal filtering.
 */
import type { EphemerisSnapshot } from '../../contracts';
import { lonToSign } from '../../astro/profile-from-snapshot';
import type { ProjectedExplanationSection } from '../projection-types';
import { taggedSectionBodyFromText } from '../tagged-text';

export type GuestSignSlug =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

const GUEST_SUN: Record<GuestSignSlug, string> = {
  aries:
    'The Sun moves through Aries. The energy is direct, initiating, and impatient with delay. This is a time for starting rather than finishing, for acting rather than deliberating. The impulse to move is stronger than the impulse to plan.',
  taurus:
    'The Sun moves through Taurus. The pace slows, the direction steadies, and what matters is what can be built rather than what can be started. This is a time for endurance, for tangible progress, for trusting what takes time.',
  gemini:
    'The Sun moves through Gemini. The energy is curious, conversational, and restless with routine. This is a time for exploration, for connecting ideas across domains, for following interests without needing to commit to any single one.',
  cancer:
    'The Sun moves through Cancer. The energy turns inward, protective, and emotionally present. This is a time for tending what matters privately, for honoring emotional truth over public performance.',
  leo:
    'The Sun moves through Leo. The energy is expressive, generous, and unapologetically visible. This is a time for creating, for performing, for allowing warmth and presence to take up the space they naturally require.',
  virgo:
    'The Sun moves through Virgo. The energy is precise, service-oriented, and attentive to what actually works. This is a time for refinement, for getting the details right, for the kind of care that shows up in the quality of the work.',
  libra:
    'The Sun moves through Libra. The energy seeks balance, beauty, and fair exchange. This is a time for partnership, for aesthetic attention, for the kind of diplomacy that holds competing truths without collapsing into either.',
  scorpio:
    'The Sun moves through Scorpio. The energy deepens, intensifies, and refuses surfaces. This is a time for confronting what is hidden, for transformation that requires honesty about what is no longer working.',
  sagittarius:
    'The Sun moves through Sagittarius. The energy expands, reaches outward, and refuses to stay contained. This is a time for philosophy, for travel in every sense, for pursuing meaning larger than the immediate.',
  capricorn:
    'The Sun moves through Capricorn. The energy is disciplined, ambitious, and oriented toward lasting achievement. This is a time for building, for earning authority through competence, for the kind of patience that produces real results.',
  aquarius:
    'The Sun moves through Aquarius. The energy is innovative, independent, and oriented toward collective good. This is a time for breaking patterns, for thinking systemically, for the kind of originality that serves something larger than individual ambition.',
  pisces:
    'The Sun moves through Pisces. The energy dissolves boundaries, deepens empathy, and opens into what cannot be fully named. This is a time for imagination, for surrender, for the kind of sensitivity that sees what rational attention misses.',
};

const GUEST_MOON: Record<GuestSignSlug, string> = {
  aries:
    'The Moon in Aries makes the emotional weather direct and reactive. Feelings arrive fast, burn hot, and move on. The mood favors action over reflection.',
  taurus:
    'The Moon in Taurus makes the emotional weather steady and grounded. Feelings settle rather than spike. The mood favors comfort, physical presence, and refusing to be rushed.',
  gemini:
    'The Moon in Gemini makes the emotional weather restless and curious. Feelings process through conversation and mental activity. The mood favors connection, variety, and thinking out loud.',
  cancer:
    'The Moon in Cancer makes the emotional weather deep, protective, and attuned to what is private. Feelings are fully felt and not easily shared. The mood favors home, safety, and emotional honesty.',
  leo:
    'The Moon in Leo makes the emotional weather warm, expressive, and generous. Feelings want to be seen and acknowledged. The mood favors celebration, creative expression, and taking up space.',
  virgo:
    'The Moon in Virgo makes the emotional weather practical and attentive. Feelings process through analysis and service. The mood favors usefulness, precision, and caring through action rather than words.',
  libra:
    'The Moon in Libra makes the emotional weather diplomatic and harmony-seeking. Feelings orient toward fairness and beauty. The mood favors partnership, aesthetic experience, and maintaining peace.',
  scorpio:
    'The Moon in Scorpio makes the emotional weather intense, private, and psychologically penetrating. Feelings run deep and do not surface casually. The mood favors truth over comfort.',
  sagittarius:
    'The Moon in Sagittarius makes the emotional weather expansive and restless. Feelings want to move, explore, and find meaning. The mood favors optimism, philosophical reach, and the refusal to stay contained.',
  capricorn:
    'The Moon in Capricorn makes the emotional weather serious, disciplined, and goal-oriented. Feelings are managed rather than expressed freely. The mood favors responsibility, structure, and emotional restraint.',
  aquarius:
    'The Moon in Aquarius makes the emotional weather detached, innovative, and collectively oriented. Feelings are experienced at a distance. The mood favors independence, unconventional responses, and thinking about the bigger picture.',
  pisces:
    'The Moon in Pisces makes the emotional weather porous, empathic, and boundaryless. Feelings absorb from the environment and do not always distinguish self from other. The mood favors imagination, compassion, and the dissolution of hard edges.',
};

const GUEST_SONIC: Record<GuestSignSlug, string> = {
  aries:
    'Sharp rhythmic attack, forward melodic drive, and harmonic intensity that does not wait for permission to begin.',
  taurus:
    'Rich sustained harmonics, grounded rhythmic pulse, and melodic patience that builds rather than rushes.',
  gemini:
    'Quick melodic movement, light contrapuntal textures, and rhythmic agility that shifts between ideas.',
  cancer:
    'Deep emotional resonance, sustained harmonic warmth, and rhythm that moves with the tide rather than against it.',
  leo:
    'Bold melodic statements, radiant harmonic warmth, and rhythm that commands attention without asking.',
  virgo:
    'Precise melodic articulation, clean harmonic structure, and rhythm that serves the music rather than displaying itself.',
  libra:
    'Balanced harmonic dialogue, graceful melodic exchange, and rhythm that holds symmetry between competing voices.',
  scorpio:
    'Dark harmonic depth, intense melodic descent, and rhythm that pulses with confrontation and renewal.',
  sagittarius:
    'Expansive melodic reach, open harmonic space, and rhythm that moves toward something larger than where it started.',
  capricorn:
    'Austere melodic authority, disciplined harmonic structure, and rhythm that builds toward mastery through sustained effort.',
  aquarius:
    'Unexpected harmonic progressions, innovative melodic breaks, and rhythm that disrupts pattern without losing coherence.',
  pisces:
    'Dissolving harmonic boundaries, fluid melodic drift, and rhythm that surrenders direction in favor of atmosphere.',
};

function signSlugFromLon(lon: number): GuestSignSlug {
  const { sign } = lonToSign(lon);
  return sign.toLowerCase() as GuestSignSlug;
}

export function formatSignName(slug: GuestSignSlug): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function planetLon(snapshot: EphemerisSnapshot, name: string): number | null {
  const planet = (snapshot.planets ?? []).find((p) => String(p.name || '').toUpperCase() === name);
  return typeof planet?.lon === 'number' ? planet.lon : null;
}

function lowercaseLead(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export function buildTodaysSoundText(
  sunSign: GuestSignSlug,
  sunSonic: string,
  moonSign: GuestSignSlug,
  moonSonic: string
): string {
  const sunName = formatSignName(sunSign);
  const moonName = formatSignName(moonSign);
  return `The Sun in ${sunName} gives today's sound ${lowercaseLead(sunSonic)} The Moon in ${moonName} adds ${lowercaseLead(moonSonic)}`;
}

function sectionFromGuestText(id: string, title: string, text: string): ProjectedExplanationSection {
  return {
    id,
    title,
    text,
    meta: {
      tagged: taggedSectionBodyFromText(text, 'claim_body'),
      claimIdsReferenced: [],
      phaseD: true,
    },
  };
}

/**
 * Guest Home sky report: Today's Sound, Sun in [Sign], Moon in [Sign].
 */
export function assembleHomeSkySections(snapshot: EphemerisSnapshot): ProjectedExplanationSection[] {
  const sunLon = planetLon(snapshot, 'SUN');
  const moonLon = planetLon(snapshot, 'MOON');
  if (sunLon == null || moonLon == null) return [];

  const sunSign = signSlugFromLon(sunLon);
  const moonSign = signSlugFromLon(moonLon);
  const sunSonic = GUEST_SONIC[sunSign];
  const moonSonic = GUEST_SONIC[moonSign];

  return [
    sectionFromGuestText(
      'todays_sound',
      "Today's Sound",
      buildTodaysSoundText(sunSign, sunSonic, moonSign, moonSonic)
    ),
    sectionFromGuestText('sky_anchor', `Sun in ${formatSignName(sunSign)}`, GUEST_SUN[sunSign]),
    sectionFromGuestText(
      'emotional_weather',
      `Moon in ${formatSignName(moonSign)}`,
      GUEST_MOON[moonSign]
    ),
  ];
}
