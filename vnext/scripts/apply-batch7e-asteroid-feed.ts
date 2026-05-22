/**
 * Batch 7E — explicit body names in ceres/chiron/juno/pallas/vesta (20 feeds each).
 * Run: npx tsx vnext/scripts/apply-batch7e-asteroid-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const TARGETS: Record<string, string> = {
  ceres: path.join(__dirname, '../projection/insight-library/insight-library-aspects-ceres.ts'),
  chiron: path.join(__dirname, '../projection/insight-library/insight-library-aspects-chiron.ts'),
  juno: path.join(__dirname, '../projection/insight-library/insight-library-aspects-juno.ts'),
  pallas: path.join(__dirname, '../projection/insight-library/insight-library-aspects-pallas.ts'),
  vesta: path.join(__dirname, '../projection/insight-library/insight-library-aspects-vesta.ts'),
};

function cap(b: string): string {
  const n = b.toLowerCase();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function lead(transit: string, natal: string, aspect: string): string {
  const T = cap(transit);
  const N = cap(natal);
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

function restsForPair(aRole: string, bRole: string): [string, string, string, string, string] {
  return [
    `One person's ${aRole} and the other person's ${bRole} are fused between these charts today. These two registers share the same pitch in this connection right now.`,
    `One person's ${aRole} and the other person's ${bRole} cooperate between these charts today. The exchange has less friction than it usually carries.`,
    `One person's ${aRole} and the other person's ${bRole} cut across each other between these charts today. The tension between them is structural and worth naming directly.`,
    `One person's ${aRole} and the other person's ${bRole} reinforce each other between these charts today. Compatible needs flow together more easily than on an ordinary day.`,
    `One person's ${aRole} and the other person's ${bRole} sit at opposite poles between these charts today. The real distance between them is visible in the foreground.`,
  ];
}

const NATAL_ROLES = {
  sun: 'identity and conscious direction',
  moon: 'emotional need and instinct',
  venus: 'aesthetic sense and valuing nature',
  mars: 'drive and forward momentum',
} as const;

function buildAsteroidGroups(
  asteroid: string,
  aRole: string
): PairGroup[] {
  const A = asteroid.toUpperCase();
  return (['sun', 'moon', 'venus', 'mars'] as const).map((natal) => ({
    prefix: `${A}_${natal.toUpperCase()}`,
    t: asteroid,
    n: natal,
    rests: restsForPair(aRole, NATAL_ROLES[natal]),
  }));
}

const ASTEROID_GROUPS: Record<string, PairGroup[]> = {
  ceres: buildAsteroidGroups('ceres', 'nurturing instinct and need to tend'),
  chiron: buildAsteroidGroups('chiron', 'healing wound and teaching-through-hurt'),
  juno: buildAsteroidGroups('juno', 'commitment impulse and partnership contract'),
  pallas: buildAsteroidGroups('pallas', 'strategic clarity and pattern wisdom'),
  vesta: buildAsteroidGroups('vesta', 'devotional focus and sacred dedication'),
};

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

for (const [name, target] of Object.entries(TARGETS)) {
  const bodies = Object.assign({}, ...ASTEROID_GROUPS[name].map(groupToBodies));
  const count = applyToFile(target, bodies);
  console.log(`Batch 7E ${name}: ${count}/${Object.keys(bodies).length}`);
}
