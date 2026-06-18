/**
 * Batch 7D , explicit body names in uranus.ts (35) + neptune.ts (35) + pluto.ts (35).
 * Run: npx tsx vnext/scripts/apply-batch7d-outer-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const URANUS_TARGET = path.join(
  __dirname,
  '../projection/insight-library/insight-library-aspects-uranus.ts'
);
const NEPTUNE_TARGET = path.join(
  __dirname,
  '../projection/insight-library/insight-library-aspects-neptune.ts'
);
const PLUTO_TARGET = path.join(
  __dirname,
  '../projection/insight-library/insight-library-aspects-pluto.ts'
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

const URANUS_GROUPS: PairGroup[] = [
  {
    prefix: 'URANUS_SUN',
    t: 'uranus',
    n: 'sun',
    rests: [
      `One person's disruptive clarity and the other person's identity are fused between these charts today. Change and selfhood share the same pitch.`,
      `One person's innovative impulse and the other person's need to be themselves cooperate between these charts today. Liberation and authenticity can support each other.`,
      `One person's need to break pattern and the other person's drive for clear self-definition cut across each other between these charts today. Surprise and stability are in structural tension.`,
      `One person's inventive energy and the other person's center of self draw from compatible sources between these charts today. Fresh perspective and visibility align more easily than usual.`,
      `One person's drive to disrupt and the other person's need for autonomous selfhood sit at opposite poles between these charts today. Change and identity may not converge in the same gesture.`,
    ],
  },
  {
    prefix: 'URANUS_MOON',
    t: 'uranus',
    n: 'moon',
    rests: [
      `One person's disruptive clarity and the other person's emotional need are fused between these charts today. Sudden insight and feeling share the same channel.`,
      `One person's innovative impulse and the other person's feeling nature cooperate between these charts today. Emotional honesty and liberating perspective can support each other.`,
      `One person's need for rupture and the other person's need for emotional safety press against each other between these charts today. Freedom and containment are both loud in the foreground.`,
      `One person's inventive energy and the other person's emotional instinct reinforce each other between these charts today. Feeling and breakthrough flow together with unusual ease.`,
      `One person's pull toward change and the other person's interior need face each other across maximum distance between these charts today. Disruption and nurture may pull apart.`,
    ],
  },
  {
    prefix: 'URANUS_VENUS',
    t: 'uranus',
    n: 'venus',
    rests: [
      `One person's disruptive clarity and the other person's aesthetic sense are fused between these charts today. Change and beauty share the same pitch.`,
      `One person's innovative impulse and the other person's valuing nature cooperate between these charts today. Fresh expression and relational grace have an easier path than usual.`,
      `One person's need to break pattern and the other person's need for harmonious connection cut across each other between these charts today. Surprise and pleasure are in structural friction.`,
      `One person's inventive energy and the other person's sense of warmth draw from compatible sources between these charts today. Liberation and appreciation reinforce each other.`,
      `One person's drive to disrupt and the other person's need for pleasing connection sit at opposite poles between these charts today. Change and harmony may not meet in the middle.`,
    ],
  },
  {
    prefix: 'URANUS_MARS',
    t: 'uranus',
    n: 'mars',
    rests: [
      `One person's disruptive clarity and the other person's drive are fused between these charts today. Sudden change and forward motion share the same voltage.`,
      `One person's innovative impulse and the other person's momentum cooperate between these charts today. Breakthrough and initiative can support each other without collision.`,
      `One person's need for rupture and the other person's need to commit now cut across each other between these charts today. Freedom and urgency are in structural tension.`,
      `One person's inventive energy and the other person's assertive drive reinforce each other between these charts today. Action and originality align more than they do on an ordinary day.`,
      `One person's pull toward change and the other person's need for decisive action face each other across maximum distance between these charts today. Disruption and momentum may not converge.`,
    ],
  },
  {
    prefix: 'URANUS_URANUS',
    t: 'uranus',
    n: 'uranus',
    rests: [
      `Two disruptive signatures occupy the same space between these charts today. When one person breaks pattern, the other recognizes the impulse immediately.`,
      `Two innovative styles cooperate between these charts today. Different needs for freedom can build on each other rather than compete.`,
      `Two drives toward rupture cut across each other between these charts today. Both needs for change are legitimate but geometrically incompatible right now.`,
      `Two inventive impulses draw from compatible sources between these charts today. Mutual liberation flows with less translation than usual.`,
      `Two poles of disruption face each other across maximum distance between these charts today. What feels liberating to one person may feel destabilizing to the other.`,
    ],
  },
  {
    prefix: 'URANUS_NEPTUNE',
    t: 'uranus',
    n: 'neptune',
    rests: [
      `One person's disruptive clarity and the other person's diffuse intuition are fused between these charts today. Sudden change and imagination share the same frequency.`,
      `One person's innovative impulse and the other person's sensitivity cooperate between these charts today. Breakthrough and subtle feeling can support each other.`,
      `One person's need for rupture and the other person's pull toward ambiguity cut across each other between these charts today. Clarity and dissolution are in structural friction.`,
      `One person's inventive energy and the other person's imaginative depth draw from compatible sources between these charts today. Vision and surprise reinforce each other.`,
      `One person's drive to disrupt and the other person's need for porous boundaries sit at opposite poles between these charts today. Change and drift may pull apart.`,
    ],
  },
  {
    prefix: 'URANUS_PLUTO',
    t: 'uranus',
    n: 'pluto',
    rests: [
      `One person's disruptive clarity and the other person's depth impulse are fused between these charts today. Sudden change and transformation share the same voltage.`,
      `One person's innovative impulse and the other person's penetrating pressure cooperate between these charts today. Liberation and depth can support each other without strain.`,
      `One person's need to break pattern and the other person's need to go beneath the surface cut across each other between these charts today. Surprise and intensity are in structural tension.`,
      `One person's inventive energy and the other person's transformative insight reinforce each other between these charts today. Power and originality align more easily than usual.`,
      `One person's pull toward rupture and the other person's compulsion toward depth face each other across maximum distance between these charts today. Change and exposure may not converge.`,
    ],
  },
];

const NEPTUNE_GROUPS: PairGroup[] = [
  {
    prefix: 'NEPTUNE_SUN',
    t: 'neptune',
    n: 'sun',
    rests: [
      `One person's diffuse intuition and the other person's identity are fused between these charts today. Imagination and selfhood share the same pitch.`,
      `One person's sensitivity and the other person's need to be themselves cooperate between these charts today. Subtle feeling and authentic presence can support each other.`,
      `One person's pull toward ambiguity and the other person's drive for clear self-definition cut across each other between these charts today. Fog and visibility are in structural tension.`,
      `One person's imaginative depth and the other person's center of self draw from compatible sources between these charts today. Inspiration and identity align more easily than usual.`,
      `One person's interior drift and the other person's need for autonomous selfhood sit at opposite poles between these charts today. Dissolution and definition may not converge.`,
    ],
  },
  {
    prefix: 'NEPTUNE_MOON',
    t: 'neptune',
    n: 'moon',
    rests: [
      `One person's diffuse intuition and the other person's emotional need are fused between these charts today. Imagination and feeling share the same channel.`,
      `One person's sensitivity and the other person's feeling nature cooperate between these charts today. Empathy and emotional honesty can support each other.`,
      `One person's pull toward ambiguity and the other person's need for emotional safety press against each other between these charts today. Dream and containment are both loud in the foreground.`,
      `One person's imaginative depth and the other person's emotional instinct reinforce each other between these charts today. Feeling and inspiration flow together with unusual ease.`,
      `One person's interior fog and the other person's interior need face each other across maximum distance between these charts today. Dissolution and nurture may pull apart.`,
    ],
  },
  {
    prefix: 'NEPTUNE_VENUS',
    t: 'neptune',
    n: 'venus',
    rests: [
      `One person's diffuse intuition and the other person's aesthetic sense are fused between these charts today. Imagination and beauty share the same pitch.`,
      `One person's sensitivity and the other person's valuing nature cooperate between these charts today. Subtle charm and relational warmth have an easier path than usual.`,
      `One person's pull toward ambiguity and the other person's need for harmonious connection cut across each other between these charts today. Idealism and pleasure are in structural friction.`,
      `One person's imaginative depth and the other person's sense of grace draw from compatible sources between these charts today. Romance and inspiration reinforce each other.`,
      `One person's need for porous boundaries and the other person's need for clear relational harmony sit at opposite poles between these charts today. Fantasy and form may not meet.`,
    ],
  },
  {
    prefix: 'NEPTUNE_MARS',
    t: 'neptune',
    n: 'mars',
    rests: [
      `One person's diffuse intuition and the other person's drive are fused between these charts today. Imagination and action share the same voltage.`,
      `One person's sensitivity and the other person's momentum cooperate between these charts today. Inspired feeling and forward motion can support each other.`,
      `One person's pull toward ambiguity and the other person's need to commit now cut across each other between these charts today. Dream and urgency are in structural tension.`,
      `One person's imaginative depth and the other person's assertive energy reinforce each other between these charts today. Compassion and initiative align more than usual.`,
      `One person's interior drift and the other person's need for decisive action face each other across maximum distance between these charts today. Dissolution and momentum may not converge.`,
    ],
  },
  {
    prefix: 'NEPTUNE_NEPTUNE',
    t: 'neptune',
    n: 'neptune',
    rests: [
      `Two diffuse signatures occupy the same space between these charts today. When one person senses the unspoken, the other recognizes the atmosphere immediately.`,
      `Two sensitive styles cooperate between these charts today. Different ways of feeling into the bond can support each other without strain.`,
      `Two pulls toward ambiguity cut across each other between these charts today. Both needs for porous boundaries are legitimate but incompatible right now.`,
      `Two imaginative impulses draw from compatible sources between these charts today. Mutual empathy flows with less translation than usual.`,
      `Two poles of dissolution face each other across maximum distance between these charts today. What feels compassionate to one person may feel evasive to the other.`,
    ],
  },
  {
    prefix: 'NEPTUNE_URANUS',
    t: 'neptune',
    n: 'uranus',
    rests: [
      `One person's diffuse intuition and the other person's disruptive clarity are fused between these charts today. Imagination and sudden change share the same frequency.`,
      `One person's sensitivity and the other person's innovative impulse cooperate between these charts today. Subtle feeling and liberating perspective can support each other.`,
      `One person's pull toward ambiguity and the other person's need to break pattern cut across each other between these charts today. Dream and rupture are in structural friction.`,
      `One person's imaginative depth and the other person's inventive energy draw from compatible sources between these charts today. Vision and surprise reinforce each other.`,
      `One person's need for dissolution and the other person's drive to disrupt sit at opposite poles between these charts today. Drift and breakthrough may pull apart.`,
    ],
  },
  {
    prefix: 'NEPTUNE_PLUTO',
    t: 'neptune',
    n: 'pluto',
    rests: [
      `One person's diffuse intuition and the other person's depth impulse are fused between these charts today. Imagination and transformation share the same voltage.`,
      `One person's sensitivity and the other person's penetrating pressure cooperate between these charts today. Compassion and depth can support each other without strain.`,
      `One person's pull toward ambiguity and the other person's need to go beneath the surface cut across each other between these charts today. Dissolution and intensity are in structural tension.`,
      `One person's imaginative depth and the other person's transformative insight reinforce each other between these charts today. Subtle power and inspiration align more easily than usual.`,
      `One person's interior fog and the other person's compulsion toward exposure face each other across maximum distance between these charts today. Fantasy and truth may not converge.`,
    ],
  },
];

const PLUTO_GROUPS: PairGroup[] = [
  {
    prefix: 'PLUTO_SUN',
    t: 'pluto',
    n: 'sun',
    rests: [
      `One person's depth impulse and the other person's identity are fused between these charts today. Transformation and selfhood share the same pitch.`,
      `One person's penetrating pressure and the other person's need to be themselves cooperate between these charts today. Difficult truth and authentic presence can support each other.`,
      `One person's need to go beneath the surface and the other person's drive for clear self-definition cut across each other between these charts today. Power and visibility are in structural tension.`,
      `One person's transformative insight and the other person's center of self draw from compatible sources between these charts today. Depth and identity align more easily than usual.`,
      `One person's compulsion toward exposure and the other person's need for autonomous selfhood sit at opposite poles between these charts today. Intensity and ease may not converge.`,
    ],
  },
  {
    prefix: 'PLUTO_MOON',
    t: 'pluto',
    n: 'moon',
    rests: [
      `One person's depth impulse and the other person's emotional need are fused between these charts today. Transformation and feeling share the same channel.`,
      `One person's penetrating pressure and the other person's feeling nature cooperate between these charts today. Emotional truth and depth can support each other.`,
      `One person's need for intensity and the other person's need for emotional safety press against each other between these charts today. Exposure and nurture are both loud in the foreground.`,
      `One person's transformative insight and the other person's emotional instinct reinforce each other between these charts today. Feeling and power flow together with unusual force.`,
      `One person's compulsion toward depth and the other person's interior need face each other across maximum distance between these charts today. Intensity and vulnerability may pull apart.`,
    ],
  },
  {
    prefix: 'PLUTO_VENUS',
    t: 'pluto',
    n: 'venus',
    rests: [
      `One person's depth impulse and the other person's aesthetic sense are fused between these charts today. Transformation and beauty share the same pitch.`,
      `One person's penetrating pressure and the other person's valuing nature cooperate between these charts today. Desire and depth have an easier path than usual.`,
      `One person's need to go beneath the surface and the other person's need for harmonious connection cut across each other between these charts today. Power and pleasure are in structural friction.`,
      `One person's transformative insight and the other person's sense of grace draw from compatible sources between these charts today. Intimacy and intensity reinforce each other.`,
      `One person's compulsion toward exposure and the other person's need for relational ease sit at opposite poles between these charts today. Depth and charm may not meet in the middle.`,
    ],
  },
  {
    prefix: 'PLUTO_MARS',
    t: 'pluto',
    n: 'mars',
    rests: [
      `One person's depth impulse and the other person's drive are fused between these charts today. Transformation and action share the same voltage.`,
      `One person's penetrating pressure and the other person's momentum cooperate between these charts today. Difficult truth and forward motion can support each other.`,
      `One person's need for intensity and the other person's need to commit now cut across each other between these charts today. Power and urgency are in structural tension.`,
      `One person's transformative insight and the other person's assertive energy reinforce each other between these charts today. Force and depth align more than they do on an ordinary day.`,
      `One person's compulsion toward exposure and the other person's need for decisive action face each other across maximum distance between these charts today. Intensity and impulse may not converge.`,
    ],
  },
  {
    prefix: 'PLUTO_PLUTO',
    t: 'pluto',
    n: 'pluto',
    rests: [
      `Two depth signatures occupy the same space between these charts today. When one person names what cannot stay hidden, the other recognizes the pressure immediately.`,
      `Two penetrating styles cooperate between these charts today. Different ways of going beneath the surface can support each other rather than compete.`,
      `Two drives toward intensity cut across each other between these charts today. Both needs for transformation are legitimate but geometrically incompatible right now.`,
      `Two transformative impulses draw from compatible sources between these charts today. Mutual depth flows with less negotiation than usual.`,
      `Two poles of power face each other across maximum distance between these charts today. What feels necessary to one person may feel overwhelming to the other.`,
    ],
  },
  {
    prefix: 'PLUTO_URANUS',
    t: 'pluto',
    n: 'uranus',
    rests: [
      `One person's depth impulse and the other person's disruptive clarity are fused between these charts today. Transformation and sudden change share the same frequency.`,
      `One person's penetrating pressure and the other person's innovative impulse cooperate between these charts today. Depth and liberation can support each other without strain.`,
      `One person's need for intensity and the other person's need to break pattern cut across each other between these charts today. Power and surprise are in structural friction.`,
      `One person's transformative insight and the other person's inventive energy reinforce each other between these charts today. Breakthrough and depth align more easily than usual.`,
      `One person's compulsion toward exposure and the other person's drive to disrupt sit at opposite poles between these charts today. Intensity and freedom may pull apart.`,
    ],
  },
  {
    prefix: 'PLUTO_NEPTUNE',
    t: 'pluto',
    n: 'neptune',
    rests: [
      `One person's depth impulse and the other person's diffuse intuition are fused between these charts today. Transformation and imagination share the same voltage.`,
      `One person's penetrating pressure and the other person's sensitivity cooperate between these charts today. Difficult truth and subtle feeling can support each other.`,
      `One person's need to go beneath the surface and the other person's pull toward ambiguity cut across each other between these charts today. Power and dissolution are in structural tension.`,
      `One person's transformative insight and the other person's imaginative depth reinforce each other between these charts today. Subtle force and inspiration flow together.`,
      `One person's compulsion toward depth and the other person's need for porous boundaries face each other across maximum distance between these charts today. Exposure and drift may not converge.`,
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

const uranusBodies = Object.assign({}...URANUS_GROUPS.map(groupToBodies));
const neptuneBodies = Object.assign({}...NEPTUNE_GROUPS.map(groupToBodies));
const plutoBodies = Object.assign({}...PLUTO_GROUPS.map(groupToBodies));

const uCount = applyToFile(URANUS_TARGET, uranusBodies);
const nCount = applyToFile(NEPTUNE_TARGET, neptuneBodies);
const pCount = applyToFile(PLUTO_TARGET, plutoBodies);

console.log(
  `Batch 7D: uranus.ts ${uCount}/${Object.keys(uranusBodies).length}, neptune.ts ${nCount}/${Object.keys(neptuneBodies).length}, pluto.ts ${pCount}/${Object.keys(plutoBodies).length}`
);
