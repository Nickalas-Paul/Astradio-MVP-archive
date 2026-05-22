/**
 * Batch 7B — explicit body names in all mercury.ts feed fields.
 * Run: npx tsx vnext/scripts/apply-batch7b-mercury-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const TARGET = path.join(__dirname, '../projection/insight-library/insight-library-aspects-mercury.ts');

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

const BODIES: Record<string, { t: string; n: string; aspect: string; rest: string }> = {
  SUN_MERCURY_CONJUNCTION: {
    t: 'sun',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `One person's identity and the other person's thinking share the same pitch between these charts today. What each person wants to express and how each person processes it are unusually aligned in this connection.`,
  },
  SUN_MERCURY_SEXTILE: {
    t: 'sun',
    n: 'mercury',
    aspect: 'sextile',
    rest: `One person's sense of self and the other person's articulation cooperate without strain between these charts today. Authentic presence and clear language can support each other rather than compete.`,
  },
  SUN_MERCURY_SQUARE: {
    t: 'sun',
    n: 'mercury',
    aspect: 'square',
    rest: `One person's drive to be themselves and the other person's need to analyze cut across each other between these charts today. The gap between identity and intellectual precision is closer to the surface than usual.`,
  },
  SUN_MERCURY_TRINE: {
    t: 'sun',
    n: 'mercury',
    aspect: 'trine',
    rest: `One person's identity and the other person's mind draw from compatible sources between these charts today. Being seen and being understood flow together more easily than they typically do.`,
  },
  SUN_MERCURY_OPPOSITION: {
    t: 'sun',
    n: 'mercury',
    aspect: 'opposition',
    rest: `One person's outward selfhood and the other person's interior thought process sit at opposite poles between these charts today. Being recognized and being comprehended may not arrive in the same moment.`,
  },
  MOON_MERCURY_CONJUNCTION: {
    t: 'moon',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `One person's emotional instinct and the other person's thinking are fused between these charts today. Feeling and articulation can show up through the same channel in this connection right now.`,
  },
  MOON_MERCURY_SEXTILE: {
    t: 'moon',
    n: 'mercury',
    aspect: 'sextile',
    rest: `One person's feeling nature and the other person's need for clear language open productive cooperation between these charts today. Emotion can be named without losing its warmth.`,
  },
  MOON_MERCURY_SQUARE: {
    t: 'moon',
    n: 'mercury',
    aspect: 'square',
    rest: `One person's emotional honesty and the other person's analytical precision press against each other between these charts today. The tension between what is felt and what is said is structural, not personal failure.`,
  },
  MOON_MERCURY_TRINE: {
    t: 'moon',
    n: 'mercury',
    aspect: 'trine',
    rest: `One person's emotional body and the other person's articulation reinforce each other between these charts today. Naming feeling and honoring it are not competing tasks right now.`,
  },
  MOON_MERCURY_OPPOSITION: {
    t: 'moon',
    n: 'mercury',
    aspect: 'opposition',
    rest: `One person's need to feel and the other person's need to translate experience into language face each other across maximum distance between these charts today. Interior emotion and exterior explanation may pull apart.`,
  },
  MERCURY_VENUS_CONJUNCTION: {
    t: 'mercury',
    n: 'venus',
    aspect: 'conjunction',
    rest: `One person's articulation and the other person's aesthetic sense are fused between these charts today. Clarity and grace can arrive as the same gesture in this connection.`,
  },
  MERCURY_VENUS_SEXTILE: {
    t: 'mercury',
    n: 'venus',
    aspect: 'sextile',
    rest: `One person's thinking and the other person's sense of beauty cooperate between these charts today. Expression and relational warmth have an easier path than usual.`,
  },
  MERCURY_VENUS_SQUARE: {
    t: 'mercury',
    n: 'venus',
    aspect: 'square',
    rest: `One person's need for precision and the other person's pull toward harmony cut across each other between these charts today. Intellectual clarity and aesthetic ease are both legitimate but not aligned right now.`,
  },
  MERCURY_VENUS_TRINE: {
    t: 'mercury',
    n: 'venus',
    aspect: 'trine',
    rest: `One person's articulation and the other person's valuing nature flow together between these charts today. What is said and what feels beautiful reinforce each other with unusual ease.`,
  },
  MERCURY_VENUS_OPPOSITION: {
    t: 'mercury',
    n: 'venus',
    aspect: 'opposition',
    rest: `One person's drive to speak plainly and the other person's need for pleasing delivery occupy opposite poles between these charts today. Expression and beauty may not converge in the same gesture.`,
  },
  MERCURY_MARS_CONJUNCTION: {
    t: 'mercury',
    n: 'mars',
    aspect: 'conjunction',
    rest: `One person's thinking and the other person's drive are fused between these charts today. Planning and execution share the same voltage in this connection right now.`,
  },
  MERCURY_MARS_SEXTILE: {
    t: 'mercury',
    n: 'mars',
    aspect: 'sextile',
    rest: `One person's articulation and the other person's momentum cooperate between these charts today. Clear language and decisive action can support each other without the usual friction.`,
  },
  MERCURY_MARS_SQUARE: {
    t: 'mercury',
    n: 'mars',
    aspect: 'square',
    rest: `One person's need to process and the other person's need to commit cut across each other between these charts today. The gap between analysis and action is visible and worth naming directly.`,
  },
  MERCURY_MARS_TRINE: {
    t: 'mercury',
    n: 'mars',
    aspect: 'trine',
    rest: `One person's strategic clarity and the other person's forward drive draw from the same source between these charts today. Thinking and doing align more than they do on an ordinary day.`,
  },
  MERCURY_MARS_OPPOSITION: {
    t: 'mercury',
    n: 'mars',
    aspect: 'opposition',
    rest: `One person's need to discuss and the other person's need to act face each other across maximum distance between these charts today. Words and movement may not arrive together.`,
  },
  MERCURY_MERCURY_CONJUNCTION: {
    t: 'mercury',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `Two communication styles occupy the same space between these charts today. When one person articulates, the other recognizes the thought process immediately.`,
  },
  MERCURY_MERCURY_SEXTILE: {
    t: 'mercury',
    n: 'mercury',
    aspect: 'sextile',
    rest: `Two ways of processing information cooperate between these charts today. Different vocabularies can build on each other rather than compete for priority.`,
  },
  MERCURY_MERCURY_SQUARE: {
    t: 'mercury',
    n: 'mercury',
    aspect: 'square',
    rest: `Two thought processes cut across each other between these charts today. Both ways of communicating are legitimate but geometrically incompatible right now.`,
  },
  MERCURY_MERCURY_TRINE: {
    t: 'mercury',
    n: 'mercury',
    aspect: 'trine',
    rest: `Two articulation styles draw from compatible sources between these charts today. Mutual understanding flows with less translation than usual.`,
  },
  MERCURY_MERCURY_OPPOSITION: {
    t: 'mercury',
    n: 'mercury',
    aspect: 'opposition',
    rest: `Two poles of thinking face each other across maximum distance between these charts today. Deliberate translation is required for either person to feel fully understood.`,
  },
  SATURN_MERCURY_CONJUNCTION: {
    t: 'saturn',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `One person's structural requirement and the other person's thinking are fused between these charts today. Discipline and articulation share the same pitch in this connection.`,
  },
  SATURN_MERCURY_SEXTILE: {
    t: 'saturn',
    n: 'mercury',
    aspect: 'sextile',
    rest: `One person's need for limits and the other person's communication style cooperate between these charts today. Clarity and accountability can support each other without strain.`,
  },
  SATURN_MERCURY_SQUARE: {
    t: 'saturn',
    n: 'mercury',
    aspect: 'square',
    rest: `One person's demand for structure and the other person's need to think freely cut across each other between these charts today. Constraint and expression are both loud in the foreground.`,
  },
  SATURN_MERCURY_TRINE: {
    t: 'saturn',
    n: 'mercury',
    aspect: 'trine',
    rest: `One person's discipline and the other person's articulation reinforce each other between these charts today. Serious thinking and clear boundaries align more easily than usual.`,
  },
  SATURN_MERCURY_OPPOSITION: {
    t: 'saturn',
    n: 'mercury',
    aspect: 'opposition',
    rest: `One person's pull toward responsibility and the other person's need for open dialogue sit at opposite poles between these charts today. Obligation and flexibility may not meet in the middle.`,
  },
  JUPITER_MERCURY_CONJUNCTION: {
    t: 'jupiter',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `One person's expansion impulse and the other person's thinking are fused between these charts today. Meaning and articulation share the same bandwidth in this connection.`,
  },
  JUPITER_MERCURY_SEXTILE: {
    t: 'jupiter',
    n: 'mercury',
    aspect: 'sextile',
    rest: `One person's sense of possibility and the other person's precision cooperate between these charts today. Big-picture thinking and clear language can support each other.`,
  },
  JUPITER_MERCURY_SQUARE: {
    t: 'jupiter',
    n: 'mercury',
    aspect: 'square',
    rest: `One person's appetite for breadth and the other person's need for exact wording cut across each other between these charts today. Scale and specificity are in structural tension.`,
  },
  JUPITER_MERCURY_TRINE: {
    t: 'jupiter',
    n: 'mercury',
    aspect: 'trine',
    rest: `One person's optimism and the other person's articulation flow together between these charts today. Ideas travel further when both people can name them clearly.`,
  },
  JUPITER_MERCURY_OPPOSITION: {
    t: 'jupiter',
    n: 'mercury',
    aspect: 'opposition',
    rest: `One person's reach for meaning and the other person's need for precise communication face each other across maximum distance between these charts today. Vision and detail may pull apart.`,
  },
  URANUS_MERCURY_CONJUNCTION: {
    t: 'uranus',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `One person's disruptive clarity and the other person's articulation are fused between these charts today. Sudden insight and everyday language share the same frequency.`,
  },
  URANUS_MERCURY_SEXTILE: {
    t: 'uranus',
    n: 'mercury',
    aspect: 'sextile',
    rest: `One person's innovative impulse and the other person's thinking cooperate between these charts today. Fresh perspective and clear expression can land without collision.`,
  },
  URANUS_MERCURY_SQUARE: {
    t: 'uranus',
    n: 'mercury',
    aspect: 'square',
    rest: `One person's need to break pattern and the other person's need for coherent explanation cut across each other between these charts today. Surprise and stability are both legitimate right now.`,
  },
  URANUS_MERCURY_TRINE: {
    t: 'uranus',
    n: 'mercury',
    aspect: 'trine',
    rest: `One person's inventive energy and the other person's articulation draw from compatible sources between these charts today. Original thinking and clear speech reinforce each other.`,
  },
  URANUS_MERCURY_OPPOSITION: {
    t: 'uranus',
    n: 'mercury',
    aspect: 'opposition',
    rest: `One person's drive to disrupt and the other person's need for predictable communication sit at opposite poles between these charts today. Change and coherence may not converge.`,
  },
  NEPTUNE_MERCURY_CONJUNCTION: {
    t: 'neptune',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `One person's diffuse intuition and the other person's thinking are fused between these charts today. Imagination and language blur into a single channel in this connection.`,
  },
  NEPTUNE_MERCURY_SEXTILE: {
    t: 'neptune',
    n: 'mercury',
    aspect: 'sextile',
    rest: `One person's sensitivity and the other person's articulation cooperate between these charts today. Subtle feeling can be named without losing its texture.`,
  },
  NEPTUNE_MERCURY_SQUARE: {
    t: 'neptune',
    n: 'mercury',
    aspect: 'square',
    rest: `One person's pull toward ambiguity and the other person's need for precision cut across each other between these charts today. What is felt and what can be said may not line up cleanly.`,
  },
  NEPTUNE_MERCURY_TRINE: {
    t: 'neptune',
    n: 'mercury',
    aspect: 'trine',
    rest: `One person's imaginative depth and the other person's language flow together between these charts today. Poetry and clarity can coexist without canceling each other.`,
  },
  NEPTUNE_MERCURY_OPPOSITION: {
    t: 'neptune',
    n: 'mercury',
    aspect: 'opposition',
    rest: `One person's interior fog and the other person's need for explicit words face each other across maximum distance between these charts today. Intuition and definition may pull apart.`,
  },
  PLUTO_MERCURY_CONJUNCTION: {
    t: 'pluto',
    n: 'mercury',
    aspect: 'conjunction',
    rest: `One person's depth impulse and the other person's thinking are fused between these charts today. What must be said and what cannot stay hidden share the same voltage.`,
  },
  PLUTO_MERCURY_SEXTILE: {
    t: 'pluto',
    n: 'mercury',
    aspect: 'sextile',
    rest: `One person's transformative pressure and the other person's articulation cooperate between these charts today. Difficult truth and clear language can support each other.`,
  },
  PLUTO_MERCURY_SQUARE: {
    t: 'pluto',
    n: 'mercury',
    aspect: 'square',
    rest: `One person's need to go beneath the surface and the other person's everyday communication cut across each other between these charts today. Power and words are in structural friction.`,
  },
  PLUTO_MERCURY_TRINE: {
    t: 'pluto',
    n: 'mercury',
    aspect: 'trine',
    rest: `One person's penetrating insight and the other person's articulation reinforce each other between these charts today. Naming what matters lands with unusual force.`,
  },
  PLUTO_MERCURY_OPPOSITION: {
    t: 'pluto',
    n: 'mercury',
    aspect: 'opposition',
    rest: `One person's compulsion toward depth and the other person's need for ordinary conversation sit at opposite poles between these charts today. Exposure and discretion may not meet in the middle.`,
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
console.log(`Batch 7B: updated ${replaced}/${Object.keys(BODIES).length} feed fields in mercury.ts`);
