/**
 * Batch 7C — explicit body names in jupiter.ts (45) + saturn.ts (40) feed fields.
 * Run: npx tsx vnext/scripts/apply-batch7c-jupiter-saturn-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const JUPITER_TARGET = path.join(
  __dirname,
  '../projection/insight-library/insight-library-aspects-jupiter.ts'
);
const SATURN_TARGET = path.join(
  __dirname,
  '../projection/insight-library/insight-library-aspects-saturn.ts'
);

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

type Spec = { t: string; n: string; aspect: string; rest: string };
type PairGroup = { prefix: string; t: string; n: string; rests: [string, string, string, string, string] };

const ASPECT_SUFFIXES = ['CONJUNCTION', 'SEXTILE', 'SQUARE', 'TRINE', 'OPPOSITION'] as const;
const ASPECTS = ['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const;

function groupToBodies(g: PairGroup): Record<string, Spec> {
  const out: Record<string, Spec> = {};
  ASPECT_SUFFIXES.forEach((suffix, i) => {
    out[`${g.prefix}_${suffix}`] = {
      t: g.t,
      n: g.n,
      aspect: ASPECTS[i],
      rest: g.rests[i],
    };
  });
  return out;
}

/** [conj, sext, sq, tri, opp] */
const JUPITER_GROUPS: PairGroup[] = [
  {
    prefix: 'JUPITER_SUN',
    t: 'jupiter',
    n: 'sun',
    rests: [
      `One person's expansion impulse and the other person's identity are fused between these charts today. Meaning and selfhood share the same pitch in this connection.`,
      `One person's sense of possibility and the other person's need to be themselves cooperate between these charts today. Growth and authenticity can support each other without strain.`,
      `One person's appetite for breadth and the other person's drive for clear self-definition cut across each other between these charts today. Scale and identity are in structural tension.`,
      `One person's optimism and the other person's center of self draw from compatible sources between these charts today. Being seen and being enlarged align more easily than usual.`,
      `One person's reach for meaning and the other person's need for autonomous selfhood sit at opposite poles between these charts today. Vision and identity may not converge in the same gesture.`,
    ],
  },
  {
    prefix: 'JUPITER_MOON',
    t: 'jupiter',
    n: 'moon',
    rests: [
      `One person's expansion impulse and the other person's emotional need are fused between these charts today. Feeling and possibility share the same channel right now.`,
      `One person's generosity of spirit and the other person's feeling nature cooperate between these charts today. Emotional warmth and hopeful breadth open productive paths.`,
      `One person's need to enlarge experience and the other person's need for emotional safety press against each other between these charts today. Abundance and containment are both legitimate but not aligned.`,
      `One person's faith in growth and the other person's emotional instinct reinforce each other between these charts today. Nurture and optimism flow together with unusual ease.`,
      `One person's pull toward expansion and the other person's interior feeling face each other across maximum distance between these charts today. Outer optimism and inner need may pull apart.`,
    ],
  },
  {
    prefix: 'JUPITER_VENUS',
    t: 'jupiter',
    n: 'venus',
    rests: [
      `One person's expansion impulse and the other person's aesthetic sense are fused between these charts today. Growth and grace can arrive as the same gesture.`,
      `One person's sense of abundance and the other person's valuing nature cooperate between these charts today. Generosity and beauty have an easier path than usual.`,
      `One person's appetite for more and the other person's need for harmonious balance cut across each other between these charts today. Excess and refinement are in structural friction.`,
      `One person's optimism and the other person's relational warmth draw from compatible sources between these charts today. Pleasure and possibility reinforce each other.`,
      `One person's reach for meaning and the other person's need for pleasing connection sit at opposite poles between these charts today. Grand gesture and intimate grace may not meet.`,
    ],
  },
  {
    prefix: 'JUPITER_MARS',
    t: 'jupiter',
    n: 'mars',
    rests: [
      `One person's expansion impulse and the other person's drive are fused between these charts today. Ambition and forward motion share the same voltage.`,
      `One person's confidence in growth and the other person's momentum cooperate between these charts today. Initiative and scale can support each other without collision.`,
      `One person's need to go bigger and the other person's need to commit now cut across each other between these charts today. Scope and execution are both loud in the foreground.`,
      `One person's faith in possibility and the other person's assertive energy reinforce each other between these charts today. Courage and vision align more than they do on an ordinary day.`,
      `One person's appetite for breadth and the other person's need for decisive action face each other across maximum distance between these charts today. Planning and pushing may not arrive together.`,
    ],
  },
  {
    prefix: 'JUPITER_JUPITER',
    t: 'jupiter',
    n: 'jupiter',
    rests: [
      `Two expansion signatures occupy the same space between these charts today. When one person reaches for meaning, the other recognizes the gesture immediately.`,
      `Two senses of possibility cooperate between these charts today. Different philosophies of growth can build on each other rather than compete.`,
      `Two appetites for scale cut across each other between these charts today. Both drives toward more are legitimate but geometrically incompatible right now.`,
      `Two optimistic impulses draw from compatible sources between these charts today. Mutual encouragement flows with less translation than usual.`,
      `Two poles of expansion face each other across maximum distance between these charts today. What feels abundant to one person may feel excessive to the other.`,
    ],
  },
  {
    prefix: 'SATURN_JUPITER',
    t: 'saturn',
    n: 'jupiter',
    rests: [
      `One person's structural requirement and the other person's expansion impulse are fused between these charts today. Limits and possibility share the same pitch.`,
      `One person's discipline and the other person's optimism cooperate between these charts today. Accountability and growth can support each other without strain.`,
      `One person's need for constraint and the other person's need for breadth cut across each other between these charts today. Caution and enthusiasm are in structural tension.`,
      `One person's seriousness and the other person's faith in growth reinforce each other between these charts today. Sustainable expansion is more available than usual.`,
      `One person's pull toward responsibility and the other person's reach for more sit at opposite poles between these charts today. Restraint and abundance may not meet in the middle.`,
    ],
  },
  {
    prefix: 'URANUS_JUPITER',
    t: 'uranus',
    n: 'jupiter',
    rests: [
      `One person's disruptive clarity and the other person's expansion impulse are fused between these charts today. Sudden change and hopeful growth share the same frequency.`,
      `One person's innovative impulse and the other person's sense of possibility cooperate between these charts today. Breakthrough and optimism can land without collision.`,
      `One person's need to break pattern and the other person's need for coherent growth cut across each other between these charts today. Surprise and faith are both legitimate right now.`,
      `One person's inventive energy and the other person's optimism draw from compatible sources between these charts today. Liberation and enlargement reinforce each other.`,
      `One person's drive to disrupt and the other person's appetite for stable meaning face each other across maximum distance between these charts today. Change and continuity may pull apart.`,
    ],
  },
  {
    prefix: 'NEPTUNE_JUPITER',
    t: 'neptune',
    n: 'jupiter',
    rests: [
      `One person's diffuse intuition and the other person's expansion impulse are fused between these charts today. Imagination and possibility blur into a single channel.`,
      `One person's sensitivity and the other person's generosity cooperate between these charts today. Subtle feeling and hopeful breadth can support each other.`,
      `One person's pull toward ambiguity and the other person's need for clear growth cut across each other between these charts today. Dream and doctrine may not line up cleanly.`,
      `One person's imaginative depth and the other person's optimism flow together between these charts today. Inspiration and scale coexist without canceling each other.`,
      `One person's interior fog and the other person's reach for meaning sit at opposite poles between these charts today. Intuition and conviction may not converge.`,
    ],
  },
  {
    prefix: 'PLUTO_JUPITER',
    t: 'pluto',
    n: 'jupiter',
    rests: [
      `One person's depth impulse and the other person's expansion impulse are fused between these charts today. Transformation and growth share the same voltage.`,
      `One person's penetrating pressure and the other person's optimism cooperate between these charts today. Difficult truth and hopeful scale can support each other.`,
      `One person's need to go beneath the surface and the other person's appetite for breadth cut across each other between these charts today. Power and possibility are in structural friction.`,
      `One person's transformative insight and the other person's faith in growth reinforce each other between these charts today. Meaning lands with unusual force.`,
      `One person's compulsion toward depth and the other person's need for open expansion face each other across maximum distance between these charts today. Intensity and ease may not meet.`,
    ],
  },
];

const SATURN_GROUPS: PairGroup[] = [
  {
    prefix: 'SATURN_SUN',
    t: 'saturn',
    n: 'sun',
    rests: [
      `One person's structural requirement and the other person's identity are fused between these charts today. Responsibility and selfhood share the same pitch.`,
      `One person's discipline and the other person's need to be themselves cooperate between these charts today. Limits and authenticity can support each other without strain.`,
      `One person's demand for accountability and the other person's drive for clear self-definition cut across each other between these charts today. Duty and identity are in structural tension.`,
      `One person's seriousness and the other person's center of self draw from compatible sources between these charts today. Maturity and visibility align more easily than usual.`,
      `One person's pull toward obligation and the other person's need for autonomous selfhood sit at opposite poles between these charts today. Constraint and freedom may not converge.`,
    ],
  },
  {
    prefix: 'SATURN_MOON',
    t: 'saturn',
    n: 'moon',
    rests: [
      `One person's structural requirement and the other person's emotional need are fused between these charts today. Limits and feeling share the same channel right now.`,
      `One person's steadiness and the other person's feeling nature cooperate between these charts today. Reliability and emotional honesty can support each other.`,
      `One person's need for boundaries and the other person's need for emotional safety press against each other between these charts today. Containment and vulnerability are both loud in the foreground.`,
      `One person's discipline and the other person's emotional instinct reinforce each other between these charts today. Care and responsibility flow together with unusual ease.`,
      `One person's pull toward duty and the other person's interior feeling face each other across maximum distance between these charts today. Obligation and need may pull apart.`,
    ],
  },
  {
    prefix: 'SATURN_VENUS',
    t: 'saturn',
    n: 'venus',
    rests: [
      `One person's structural requirement and the other person's aesthetic sense are fused between these charts today. Commitment and beauty share the same pitch.`,
      `One person's reliability and the other person's valuing nature cooperate between these charts today. Serious care and relational warmth have an easier path than usual.`,
      `One person's need for limits and the other person's need for harmonious connection cut across each other between these charts today. Duty and pleasure are in structural friction.`,
      `One person's maturity and the other person's sense of grace draw from compatible sources between these charts today. Loyalty and aesthetic attunement reinforce each other.`,
      `One person's pull toward responsibility and the other person's need for ease sit at opposite poles between these charts today. Formality and intimacy may not meet in the middle.`,
    ],
  },
  {
    prefix: 'SATURN_MARS',
    t: 'saturn',
    n: 'mars',
    rests: [
      `One person's structural requirement and the other person's drive are fused between these charts today. Discipline and action share the same voltage.`,
      `One person's steadiness and the other person's momentum cooperate between these charts today. Patience and initiative can support each other without collision.`,
      `One person's need for caution and the other person's need to commit now cut across each other between these charts today. Delay and urgency are in structural tension.`,
      `One person's endurance and the other person's assertive energy reinforce each other between these charts today. Sustained effort and forward motion align more than usual.`,
      `One person's pull toward restraint and the other person's drive for immediate action face each other across maximum distance between these charts today. Caution and impulse may not converge.`,
    ],
  },
  {
    prefix: 'SATURN_SATURN',
    t: 'saturn',
    n: 'saturn',
    rests: [
      `Two structural signatures occupy the same space between these charts today. When one person names a limit, the other recognizes the weight immediately.`,
      `Two senses of responsibility cooperate between these charts today. Different standards of accountability can align without competing for priority.`,
      `Two demands for discipline cut across each other between these charts today. Both needs for control are legitimate but geometrically incompatible right now.`,
      `Two mature impulses draw from compatible sources between these charts today. Mutual reliability flows with less negotiation than usual.`,
      `Two poles of obligation face each other across maximum distance between these charts today. What feels necessary to one person may feel burdensome to the other.`,
    ],
  },
  {
    prefix: 'URANUS_SATURN',
    t: 'uranus',
    n: 'saturn',
    rests: [
      `One person's disruptive clarity and the other person's structural requirement are fused between these charts today. Change and constraint share the same frequency.`,
      `One person's innovative impulse and the other person's discipline cooperate between these charts today. Liberation and stability can support each other without strain.`,
      `One person's need to break pattern and the other person's need for reliable structure cut across each other between these charts today. Freedom and form are in structural friction.`,
      `One person's inventive energy and the other person's maturity draw from compatible sources between these charts today. Reform and responsibility reinforce each other.`,
      `One person's drive to disrupt and the other person's need for predictable order sit at opposite poles between these charts today. Surprise and routine may pull apart.`,
    ],
  },
  {
    prefix: 'NEPTUNE_SATURN',
    t: 'neptune',
    n: 'saturn',
    rests: [
      `One person's diffuse intuition and the other person's structural requirement are fused between these charts today. Imagination and limits blur into a single channel.`,
      `One person's sensitivity and the other person's steadiness cooperate between these charts today. Subtle feeling and clear boundaries can support each other.`,
      `One person's pull toward ambiguity and the other person's need for definition cut across each other between these charts today. Dream and duty may not line up cleanly.`,
      `One person's imaginative depth and the other person's discipline flow together between these charts today. Compassion and accountability coexist without canceling each other.`,
      `One person's interior fog and the other person's need for explicit structure face each other across maximum distance between these charts today. Dissolution and form may not converge.`,
    ],
  },
  {
    prefix: 'PLUTO_SATURN',
    t: 'pluto',
    n: 'saturn',
    rests: [
      `One person's depth impulse and the other person's structural requirement are fused between these charts today. Transformation and limits share the same voltage.`,
      `One person's penetrating pressure and the other person's discipline cooperate between these charts today. Difficult truth and mature restraint can support each other.`,
      `One person's need to go beneath the surface and the other person's need for orderly control cut across each other between these charts today. Power and protocol are in structural friction.`,
      `One person's transformative insight and the other person's reliability reinforce each other between these charts today. Serious change lands with unusual force.`,
      `One person's compulsion toward depth and the other person's need for predictable structure sit at opposite poles between these charts today. Exposure and discretion may not meet.`,
    ],
  },
];

function buildFeed(entry: Spec): string {
  return `${lead(entry.t, entry.n, entry.aspect)} ${entry.rest}`;
}

function applyToFile(target: string, bodies: Record<string, Spec>): number {
  let txt = fs.readFileSync(target, 'utf8');
  let replaced = 0;
  for (const [key, spec] of Object.entries(bodies)) {
    const feedText = buildFeed(spec);
    const escaped = feedText.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const re = new RegExp(
      `(\\s+${key}:\\s*\\{[\\s\\S]*?feed:\\s*)\`[\\s\\S]*?\`(\\s*,\\s*\\n\\s*sonic:)`,
      'm'
    );
    const next = txt.replace(re, `$1\`${escaped}\`$2`);
    if (next === txt) {
      console.error(`WARN: no replace for ${key} in ${path.basename(target)}`);
    } else {
      replaced++;
      txt = next;
    }
  }
  fs.writeFileSync(target, txt);
  return replaced;
}

const jupiterBodies = Object.assign({}, ...JUPITER_GROUPS.map(groupToBodies));
const saturnBodies = Object.assign({}, ...SATURN_GROUPS.map(groupToBodies));

const jCount = applyToFile(JUPITER_TARGET, jupiterBodies);
const sCount = applyToFile(SATURN_TARGET, saturnBodies);

console.log(
  `Batch 7C: jupiter.ts ${jCount}/${Object.keys(jupiterBodies).length}, saturn.ts ${sCount}/${Object.keys(saturnBodies).length}`
);
