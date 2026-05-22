/**
 * Batch 7A — explicit body names in all personal.ts feed fields.
 * Run: npx tsx vnext/scripts/apply-batch7a-personal-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const TARGET = path.join(__dirname, '../projection/insight-library/insight-library-aspects-personal.ts');

function cap(b: string): string {
  const n = b.toLowerCase();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function lead(transit: string, natal: string, aspect: string): string {
  const T = cap(transit);
  const N = cap(natal);
  if (transit === natal) {
    if (aspect === 'conjunction') {
      return `Transiting ${T} meets natal ${N} at the same degree between these charts today.`;
    }
    if (aspect === 'opposition') {
      return `Transiting ${T} opposes natal ${N} between these charts today.`;
    }
    if (aspect === 'square') {
      return `Transiting ${T} forms a square to natal ${N} between these charts today.`;
    }
    if (aspect === 'trine') {
      return `Transiting ${T} forms a trine to natal ${N} between these charts today.`;
    }
    return `Transiting ${T} forms a sextile to natal ${N} between these charts today.`;
  }
  switch (aspect) {
    case 'conjunction':
      return `Transiting ${T} meets natal ${N} at the same degree between these charts today.`;
    case 'sextile':
      return `Transiting ${T} forms a sextile to natal ${N} between these charts today.`;
    case 'square':
      return `Transiting ${T} forms a square to natal ${N} between these charts today.`;
    case 'trine':
      return `Transiting ${T} forms a trine to natal ${N} between these charts today.`;
    case 'opposition':
      return `Transiting ${T} opposes natal ${N} between these charts today.`;
    default:
      return `Transiting ${T} aspects natal ${N} between these charts today.`;
  }
}

/** key -> feed body (without lead; lead prepended) */
const BODIES: Record<string, { t: string; n: string; aspect: string; rest: string }> = {
  SUN_MOON_CONJUNCTION: {
    t: 'sun',
    n: 'moon',
    aspect: 'conjunction',
    rest: `One person's conscious direction and the other person's emotional need share the same pitch between these charts right now. Intent and feeling are unusually aligned in this connection today.`,
  },
  SUN_MOON_SEXTILE: {
    t: 'sun',
    n: 'moon',
    aspect: 'sextile',
    rest: `One person's sense of purpose and the other person's need for emotional safety cooperate without strain between these charts today. What each person wants to express and what each person needs to feel have an easier path than usual.`,
  },
  SUN_MOON_SQUARE: {
    t: 'sun',
    n: 'moon',
    aspect: 'square',
    rest: `One person's will to act and the other person's emotional instinct cut across each other between these charts today. The tension that usually hums beneath the surface is asking to be named directly.`,
  },
  SUN_MOON_TRINE: {
    t: 'sun',
    n: 'moon',
    aspect: 'trine',
    rest: `One person's identity and the other person's emotional body draw from compatible sources between these charts today. What flows easily in this bond is flowing more easily right now.`,
  },
  SUN_MOON_OPPOSITION: {
    t: 'sun',
    n: 'moon',
    aspect: 'opposition',
    rest: `One person's outward direction and the other person's interior feeling sit at opposite poles between these charts today. The pull between visibility and emotional truth is more workable when named.`,
  },
  SUN_VENUS_CONJUNCTION: {
    t: 'sun',
    n: 'venus',
    aspect: 'conjunction',
    rest: `One person's identity and the other person's sense of beauty are fused between these charts today. Authentic presence and relational grace can show up as the same gesture.`,
  },
  SUN_VENUS_SEXTILE: {
    t: 'sun',
    n: 'venus',
    aspect: 'sextile',
    rest: `One person's self-expression and the other person's aesthetic warmth open productive channels between these charts today. Contact has less friction than it usually carries.`,
  },
  SUN_VENUS_SQUARE: {
    t: 'sun',
    n: 'venus',
    aspect: 'square',
    rest: `One person's drive to be themselves and the other person's pull toward harmony press against each other between these charts today. What each person actually needs from the other is closer to the surface.`,
  },
  SUN_VENUS_TRINE: {
    t: 'sun',
    n: 'venus',
    aspect: 'trine',
    rest: `One person's identity and the other person's valuing nature support each other between these charts today. Authenticity and beauty are not competing for the same space right now.`,
  },
  SUN_VENUS_OPPOSITION: {
    t: 'sun',
    n: 'venus',
    aspect: 'opposition',
    rest: `One person's need for autonomy and the other person's need for closeness face each other across maximum distance between these charts today. The real gap between selfhood and attachment is visible.`,
  },
  SUN_MARS_CONJUNCTION: {
    t: 'sun',
    n: 'mars',
    aspect: 'conjunction',
    rest: `One person's identity and the other person's drive are fused between these charts today. Force and self-definition share the same voltage in this connection right now.`,
  },
  SUN_MARS_SEXTILE: {
    t: 'sun',
    n: 'mars',
    aspect: 'sextile',
    rest: `One person's direction and the other person's momentum cooperate between these charts today. Initiative and follow-through have a clearer path than they typically do.`,
  },
  SUN_MARS_SQUARE: {
    t: 'sun',
    n: 'mars',
    aspect: 'square',
    rest: `One person's sense of who they are and the other person's assertive drive are at structural friction between these charts today. The heat between identity and action will not stay background.`,
  },
  SUN_MARS_TRINE: {
    t: 'sun',
    n: 'mars',
    aspect: 'trine',
    rest: `One person's purpose and the other person's energy draw from the same source between these charts today. Forward motion and self-definition align more than they do on an ordinary day.`,
  },
  SUN_MARS_OPPOSITION: {
    t: 'sun',
    n: 'mars',
    aspect: 'opposition',
    rest: `One person's center of identity and the other person's pursuit of action occupy opposite poles between these charts today. Assertion and selfhood are both loud in the foreground.`,
  },
  MOON_VENUS_CONJUNCTION: {
    t: 'moon',
    n: 'venus',
    aspect: 'conjunction',
    rest: `One person's emotional need and the other person's aesthetic sense are fused between these charts today. Comfort and beauty arrive through the same channel right now.`,
  },
  MOON_VENUS_SEXTILE: {
    t: 'moon',
    n: 'venus',
    aspect: 'sextile',
    rest: `One person's feeling nature and the other person's relational warmth open easy cooperation between these charts today. Emotional generosity is more available than usual.`,
  },
  MOON_VENUS_SQUARE: {
    t: 'moon',
    n: 'venus',
    aspect: 'square',
    rest: `One person's emotional honesty and the other person's desire for grace cut across each other between these charts today. Naming the gap between feeling and harmony is useful.`,
  },
  MOON_VENUS_TRINE: {
    t: 'moon',
    n: 'venus',
    aspect: 'trine',
    rest: `One person's emotional instinct and the other person's sense of beauty flow together between these charts today. Warmth and aesthetic attunement reinforce each other.`,
  },
  MOON_VENUS_OPPOSITION: {
    t: 'moon',
    n: 'venus',
    aspect: 'opposition',
    rest: `One person's need for safety and the other person's need for closeness face each other across the full axis between these charts today. The distance is worth examining directly.`,
  },
  MOON_MARS_CONJUNCTION: {
    t: 'moon',
    n: 'mars',
    aspect: 'conjunction',
    rest: `One person's emotional instinct and the other person's drive are fused between these charts today. Feeling and action share the same impulse in this connection.`,
  },
  MOON_MARS_SEXTILE: {
    t: 'moon',
    n: 'mars',
    aspect: 'sextile',
    rest: `One person's emotional body and the other person's responsive drive cooperate between these charts today. What needs to happen has a more direct path right now.`,
  },
  MOON_MARS_SQUARE: {
    t: 'moon',
    n: 'mars',
    aspect: 'square',
    rest: `One person's need for safety and the other person's push to act are at friction between these charts today. The tension between tending and moving is structural.`,
  },
  MOON_MARS_TRINE: {
    t: 'moon',
    n: 'mars',
    aspect: 'trine',
    rest: `One person's feeling nature and the other person's momentum draw from compatible sources between these charts today. Emotion and decisive movement support each other.`,
  },
  MOON_MARS_OPPOSITION: {
    t: 'moon',
    n: 'mars',
    aspect: 'opposition',
    rest: `One person's emotional depth and the other person's assertive force sit at opposite poles between these charts today. The feeling-action axis is fully lit.`,
  },
  VENUS_MARS_CONJUNCTION: {
    t: 'venus',
    n: 'mars',
    aspect: 'conjunction',
    rest: `One person's aesthetic pull and the other person's drive are fused between these charts today. Desire, beauty, and pursuit share one channel in this connection.`,
  },
  VENUS_MARS_SEXTILE: {
    t: 'venus',
    n: 'mars',
    aspect: 'sextile',
    rest: `One person's sense of attraction and the other person's willingness to pursue cooperate between these charts today. Approach and desire have lower friction than usual.`,
  },
  VENUS_MARS_SQUARE: {
    t: 'venus',
    n: 'mars',
    aspect: 'square',
    rest: `One person's taste for harmony and the other person's decisive push cut across each other between these charts today. Grace and force are both real and not aligned.`,
  },
  VENUS_MARS_TRINE: {
    t: 'venus',
    n: 'mars',
    aspect: 'trine',
    rest: `One person's valuing nature and the other person's drive draw from the same source between these charts today. Passion and beauty reinforce each other in this bond.`,
  },
  VENUS_MARS_OPPOSITION: {
    t: 'venus',
    n: 'mars',
    aspect: 'opposition',
    rest: `One person's receptivity and the other person's assertion face each other across maximum distance between these charts today. The desire axis is more charged than usual.`,
  },
  SUN_SUN_CONJUNCTION: {
    t: 'sun',
    n: 'sun',
    aspect: 'conjunction',
    rest: `Two senses of identity occupy the same degree between these charts today. How each person directs will and expresses self is fused in this connection right now.`,
  },
  SUN_SUN_SEXTILE: {
    t: 'sun',
    n: 'sun',
    aspect: 'sextile',
    rest: `Two ways of expressing identity cooperate between these charts today. Compatible modes of self-direction are easier to access than on an ordinary day.`,
  },
  SUN_SUN_SQUARE: {
    t: 'sun',
    n: 'sun',
    aspect: 'square',
    rest: `Two expressions of will cut across each other between these charts today. The gap between how each person defines self is closer to the surface and worth naming.`,
  },
  SUN_SUN_TRINE: {
    t: 'sun',
    n: 'sun',
    aspect: 'trine',
    rest: `Two identity styles draw from the same elemental source between these charts today. Self-expression between these people flows with unusual coherence.`,
  },
  SUN_SUN_OPPOSITION: {
    t: 'sun',
    n: 'sun',
    aspect: 'opposition',
    rest: `Two poles of identity face each other across maximum distance between these charts today. The contrast in how each person shines is visible and consequential.`,
  },
  MOON_MOON_CONJUNCTION: {
    t: 'moon',
    n: 'moon',
    aspect: 'conjunction',
    rest: `Two emotional instincts occupy the same degree between these charts today. What each person needs to feel safe is meeting in one shared space.`,
  },
  MOON_MOON_SEXTILE: {
    t: 'moon',
    n: 'moon',
    aspect: 'sextile',
    rest: `Two feeling natures cooperate between these charts today. Emotional processing and instinctual response have an easier channel than usual.`,
  },
  MOON_MOON_SQUARE: {
    t: 'moon',
    n: 'moon',
    aspect: 'square',
    rest: `Two emotional bodies are at friction between these charts today. Incompatible ways of seeking safety are closer to the surface and ask for honesty.`,
  },
  MOON_MOON_TRINE: {
    t: 'moon',
    n: 'moon',
    aspect: 'trine',
    rest: `Two lunar instincts draw from the same source between these charts today. Emotional rhythm and need land in compatible territory.`,
  },
  MOON_MOON_OPPOSITION: {
    t: 'moon',
    n: 'moon',
    aspect: 'opposition',
    rest: `Two poles of feeling face each other across maximum distance between these charts today. The emotional polarity between these charts is fully visible.`,
  },
  VENUS_VENUS_CONJUNCTION: {
    t: 'venus',
    n: 'venus',
    aspect: 'conjunction',
    rest: `Two aesthetic sensibilities meet at the same degree between these charts today. What each person values and finds beautiful is fused in this connection.`,
  },
  VENUS_VENUS_SEXTILE: {
    t: 'venus',
    n: 'venus',
    aspect: 'sextile',
    rest: `Two valuing natures cooperate between these charts today. Relational warmth and taste have an easier passage than they usually do.`,
  },
  VENUS_VENUS_SQUARE: {
    t: 'venus',
    n: 'venus',
    aspect: 'square',
    rest: `Two senses of beauty are at friction between these charts today. Incompatible ways of creating harmony press against each other and ask to be named.`,
  },
  VENUS_VENUS_TRINE: {
    t: 'venus',
    n: 'venus',
    aspect: 'trine',
    rest: `Two Venusian instincts flow together between these charts today. Shared pleasure and relational grace reinforce each other in this bond.`,
  },
  VENUS_VENUS_OPPOSITION: {
    t: 'venus',
    n: 'venus',
    aspect: 'opposition',
    rest: `Two poles of value face each other across maximum distance between these charts today. The contrast in what each person finds beautiful is lit up.`,
  },
  MARS_MARS_CONJUNCTION: {
    t: 'mars',
    n: 'mars',
    aspect: 'conjunction',
    rest: `Two assertive drives meet at the same degree between these charts today. Pursuit, force, and forward motion share one channel between these people.`,
  },
  MARS_MARS_SEXTILE: {
    t: 'mars',
    n: 'mars',
    aspect: 'sextile',
    rest: `Two Mars signatures cooperate between these charts today. Compatible ways of pushing forward are easier to access than on an ordinary day.`,
  },
  MARS_MARS_SQUARE: {
    t: 'mars',
    n: 'mars',
    aspect: 'square',
    rest: `Two drives are at friction between these charts today. Incompatible ways of asserting and pursuing cut across each other and will not stay quiet.`,
  },
  MARS_MARS_TRINE: {
    t: 'mars',
    n: 'mars',
    aspect: 'trine',
    rest: `Two martial energies draw from the same source between these charts today. Shared momentum and initiative align with unusual ease.`,
  },
  MARS_MARS_OPPOSITION: {
    t: 'mars',
    n: 'mars',
    aspect: 'opposition',
    rest: `Two poles of assertion face each other across maximum distance between these charts today. The contest between drives is in the foreground.`,
  },
};

function buildFeed(entry: { t: string; n: string; aspect: string; rest: string }): string {
  return `${lead(entry.t, entry.n, entry.aspect)} ${entry.rest}`;
}

let txt = fs.readFileSync(TARGET, 'utf8');
let replaced = 0;

for (const [key, spec] of Object.entries(BODIES)) {
  const feedText = buildFeed(spec);
  const escaped = feedText.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
  const re = new RegExp(
    `(\\s+${key}:\\s*\\{[\\s\\S]*?feed:\\s*)\`[\\s\\S]*?\`(\\s*,\\s*\\n\\s*sonic:)`,
    'm'
  );
  const next = txt.replace(re, `$1\`${escaped}\`$2`);
  if (next === txt) {
    console.error(`WARN: no replace for ${key}`);
  } else {
    replaced++;
    txt = next;
  }
}

fs.writeFileSync(TARGET, txt);
console.log(`Batch 7A: updated ${replaced}/${Object.keys(BODIES).length} feed fields in personal.ts`);
