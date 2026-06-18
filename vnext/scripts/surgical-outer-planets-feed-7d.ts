/**
 * Batch 7D , surgical uranus.ts + neptune.ts + pluto.ts feeds from 899e0a2 prose.
 * Run: npx tsx vnext/scripts/surgical-outer-planets-feed-7d.ts
 * Preview samples: npx tsx vnext/scripts/surgical-outer-planets-feed-7d.ts --samples
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.join(__dirname, '../..');
const OLD_COMMIT = '899e0a2';

const TARGETS = [
  { file: 'insight-library-aspects-uranus.ts', review: 'uranus-feed-surgical-review.md', label: 'uranus.ts' },
  { file: 'insight-library-aspects-neptune.ts', review: 'neptune-feed-surgical-review.md', label: 'neptune.ts' },
  { file: 'insight-library-aspects-pluto.ts', review: 'pluto-feed-surgical-review.md', label: 'pluto.ts' },
] as const;

const BODY_LABEL: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  saturn: 'Saturn',
  jupiter: 'Jupiter',
  uranus: 'Uranus',
  neptune: 'Neptune',
  pluto: 'Pluto',
};

const URANUS_OPPOSITION_OPENER: Record<string, string> = {
  URANUS_SUN_OPPOSITION:
    'Uranus and Sun span the identity–awakening axis at full polarity between these charts today',
  URANUS_MOON_OPPOSITION:
    'Uranus and Moon pull from opposite ends of the security–liberation spectrum between these charts today',
  URANUS_VENUS_OPPOSITION:
    'Uranus and Venus sit at opposing ends of the freedom–harmony axis between these charts today',
  URANUS_MARS_OPPOSITION:
    'Uranus opposes Mars across these charts today, disruption and drive on opposite ends of the field.',
  URANUS_URANUS_OPPOSITION:
    'Uranus and Uranus occupy opposite ends of the pattern–break axis between these charts today',
  URANUS_NEPTUNE_OPPOSITION:
    'Uranus and Neptune span the shock–dissolve polarity between these charts today',
  URANUS_PLUTO_OPPOSITION:
    'Uranus and Pluto stand on opposite sides of the rupture–depth divide between these charts today',
};

const NEPTUNE_OPPOSITION_OPENER: Record<string, string> = {
  NEPTUNE_SUN_OPPOSITION:
    'Neptune and Sun span the identity–mystery axis at full polarity between these charts today',
  NEPTUNE_MOON_OPPOSITION:
    'Neptune and Moon pull from opposite ends of the feeling–dissolution spectrum between these charts today',
  NEPTUNE_VENUS_OPPOSITION:
    'Neptune and Venus sit at opposing ends of the beauty–boundary axis between these charts today',
  NEPTUNE_MARS_OPPOSITION:
    'Neptune opposes Mars across these charts today, dream and force on opposite ends of the field.',
  NEPTUNE_NEPTUNE_OPPOSITION:
    'Neptune and Neptune occupy opposite ends of the veil–clarity axis between these charts today',
  NEPTUNE_URANUS_OPPOSITION:
    'Neptune and Uranus span the dissolve–awaken polarity between these charts today',
  NEPTUNE_PLUTO_OPPOSITION:
    'Neptune and Pluto stand on opposite sides of the fog–power divide between these charts today',
};

const PLUTO_OPPOSITION_OPENER: Record<string, string> = {
  PLUTO_SUN_OPPOSITION:
    'Pluto and Sun span the identity–power axis at full polarity between these charts today',
  PLUTO_MOON_OPPOSITION:
    'Pluto and Moon pull from opposite ends of the safety–exposure spectrum between these charts today',
  PLUTO_VENUS_OPPOSITION:
    'Pluto and Venus sit at opposing ends of the love–intensity axis between these charts today',
  PLUTO_MARS_OPPOSITION:
    'Pluto opposes Mars across these charts today, depth and drive on opposite ends of the field.',
  PLUTO_PLUTO_OPPOSITION:
    'Pluto and Pluto occupy opposite ends of the control–surrender axis between these charts today',
  PLUTO_URANUS_OPPOSITION:
    'Pluto and Uranus pull transformation and rupture in opposite directions between these charts today',
  PLUTO_NEPTUNE_OPPOSITION:
    'Pluto and Neptune span the power–dissolve polarity between these charts today',
};

const OUTER_TRINE_OPENER: Record<string, string> = {
  PLUTO_VENUS_TRINE:
    'Pluto and Venus draw from the same love–depth current between these charts today',
  URANUS_SUN_TRINE: 'Uranus and Sun flow in natural harmony between these charts today',
  URANUS_NEPTUNE_TRINE:
    'Uranus and Neptune flow together between rupture and dissolution between these charts today',
  URANUS_PLUTO_TRINE:
    'Uranus and Pluto draw from the same revolution–depth current between these charts today',
  NEPTUNE_MOON_TRINE:
    'Neptune and Moon reinforce each other between feeling and transcendence between these charts today',
  NEPTUNE_PLUTO_TRINE:
    'Neptune and Pluto flow together between mysticism and transformation between these charts today',
};

const OUTER_SEXTILE_OPENER: Record<string, string> = {
  URANUS_NEPTUNE_SEXTILE:
    'Uranus and Neptune open a cooperative channel between these charts today',
  URANUS_PLUTO_SEXTILE: 'Uranus and Pluto ease the passage between shock and depth between these charts today',
  NEPTUNE_URANUS_SEXTILE:
    'Neptune and Uranus soften the boundary between dream and awakening between these charts today',
  NEPTUNE_PLUTO_SEXTILE:
    'Neptune and Pluto open a channel for depth to find form between these charts today',
};

const SAMPLE_KEYS = [
  'URANUS_SUN_OPPOSITION',
  'NEPTUNE_MOON_SQUARE',
  'PLUTO_VENUS_TRINE',
];

const SAMPLE_SOURCES: Record<string, string> = {
  URANUS_SUN_OPPOSITION: 'insight-library-aspects-uranus.ts',
  NEPTUNE_MOON_SQUARE: 'insight-library-aspects-neptune.ts',
  PLUTO_VENUS_TRINE: 'insight-library-aspects-pluto.ts',
};

function capBody(b: string): string {
  return BODY_LABEL[b.toLowerCase()] ?? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

function parseKey(key: string): { t: string; n: string; aspect: string; same: boolean } {
  const m = key.match(/^([A-Z]+)_([A-Z]+)_(CONJUNCTION|SEXTILE|SQUARE|TRINE|OPPOSITION)$/);
  if (!m) throw new Error(`bad key ${key}`);
  return { t: m[1]!.toLowerCase(), n: m[2]!.toLowerCase(), aspect: m[3]!.toLowerCase(), same: m[1] === m[2] };
}

function allMaps() {
  return {
    opposition: { ...URANUS_OPPOSITION_OPENER...NEPTUNE_OPPOSITION_OPENER...PLUTO_OPPOSITION_OPENER },
    trine: { ...OUTER_TRINE_OPENER },
    sextile: { ...OUTER_SEXTILE_OPENER },
  };
}

function defaultOpener(spec: ReturnType<typeof parseKey>): string {
  const T = capBody(spec.t);
  const N = capBody(spec.n);
  if (spec.same) {
    switch (spec.aspect) {
      case 'conjunction':
        return `${T} meets ${N} at the same degree between these charts today`;
      case 'sextile':
        return `${T} forms a sextile to ${N} between these charts today`;
      case 'square':
        return `${T} and ${N} are at friction point between these charts today`;
      case 'trine':
        return `${T} and ${N} flow together in natural harmony between these charts today`;
      case 'opposition':
        return `${T} and ${N} face each other across maximum distance between these charts today`;
      default:
        return `${T} aspects ${N} between these charts today`;
    }
  }
  switch (spec.aspect) {
    case 'conjunction':
      return `${T} and ${N} meet at the same degree between these charts today`;
    case 'sextile':
      return `Transiting ${T} forms a sextile to natal ${N} between these charts today`;
    case 'square':
      return `${T} and ${N} are at friction point between these charts today`;
    case 'trine':
      return `${T} and ${N} flow together in natural harmony between these charts today`;
    case 'opposition':
      return `${T} and ${N} face each other across maximum distance between these charts today`;
    default:
      return `Transiting ${T} aspects natal ${N} between these charts today`;
  }
}

function resolveOpener(key: string, spec: ReturnType<typeof parseKey>): string {
  const maps = allMaps();
  if (spec.aspect === 'opposition' && maps.opposition[key]) return maps.opposition[key]!;
  if (spec.aspect === 'trine' && maps.trine[key]) return maps.trine[key]!;
  if (spec.aspect === 'sextile' && maps.sextile[key]) return maps.sextile[key]!;
  return defaultOpener(spec);
}

function splitSentences(feed: string): string[] {
  const parts = feed.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  return (parts ?? [feed]).map((s) => s.trim()).filter(Boolean);
}

function hasVagueShell(s: string): boolean {
  return (
    /\bthe current sky\b/i.test(s) ||
    /\btoday'?s transit\b/i.test(s) ||
    /\btoday'?s transits\b/i.test(s) ||
    /\ba transit\b/i.test(s) ||
    /\btransit field\b/i.test(s) ||
    /\bUranus's transit\b/i.test(s) ||
    /\bNeptune's transit\b/i.test(s) ||
    /\bPluto's transit\b/i.test(s) ||
    /\bJupiter's transit\b/i.test(s) ||
    /\bSaturn's transit\b/i.test(s)
  );
}

function stripVagueShell(s: string): string {
  let r = s.trim();
  r = r.replace(/^The current sky is /i, '');
  r = r.replace(/^Today's transit field is /i, '');
  r = r.replace(/^Today's transits are /i, '');
  r = r.replace(/^A transit is /i, '');
  r = r.replace(/^Uranus's transit is illuminating both ends of /i, '');
  r = r.replace(/^Uranus's transit is illuminating /i, '');
  r = r.replace(/^Uranus's transit is /i, '');
  r = r.replace(/^Neptune's transit is pressing on /i, 'pressing on ');
  r = r.replace(/^Neptune's transit is /i, '');
  r = r.replace(/^Pluto's transit is /i, '');
  r = r.replace(/^The current sky is amplifying the natural alignment between /i, '');
  r = r.replace(/^The current sky is amplifying /i, '');
  r = r.replace(/^Today's transit is /i, '');
  r = r.replace(/^Opening a window where /i, '');
  r = r.replace(/^Making visible the tension between /i, 'The tension between ');
  r = r.replace(/^The current sky is making visible the tension between /i, 'The tension between ');
  r = r.replace(/^The current sky is making visible the gap between /i, 'The gap between ');
  r = r.replace(/^The current sky is making visible /i, '');
  r = r.replace(/^Amplifying how easily /i, '');
  r = r.trim();
  if (r && /^[a-z]/.test(r)) r = r.charAt(0).toUpperCase() + r.slice(1);
  return r;
}

function openerAlreadyNamesBodies(s: string, t: string, n: string): boolean {
  if (isTemplateOpener(s)) return false;
  const low = s.toLowerCase();
  return (
    new RegExp(`\\b${t}\\b`, 'i').test(low) &&
    new RegExp(`\\b${n}\\b`, 'i').test(low) &&
    !hasVagueShell(s) &&
    !/\bnatal\b/i.test(s)
  );
}

function isTemplateOpener(s: string): boolean {
  return (
    /^Transiting \w+/i.test(s) ||
    /^The current sky/i.test(s) ||
    /^Today's transit/i.test(s) ||
    /^A transit is/i.test(s) ||
    /^Uranus's transit/i.test(s) ||
    /^Neptune's transit/i.test(s) ||
    /^Pluto's transit/i.test(s) ||
    /\bOpening a window where\b/i.test(s) ||
    /\bOpening channels where\b/i.test(s)
  );
}

function joinParts(parts: string[]): string {
  const joined = parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return joined.replace(
    /between these charts today ([A-Z])/g,
    'between these charts today. $1'
  );
}

function polishFeed(feed: string): string {
  let r = feed;
  r = r.replace(/\bOpening channels where\b/g, 'This opens channels where');
  r = r.replace(
    /\bThe tension between ([^.]+?) in this connection\./g,
    'The tension between $1 is visible in this connection.'
  );
  r = r.replace(
    /\bThe gap between ([^.]+?) in this connection\./g,
    'The gap between $1 is visible in this connection.'
  );
  r = r.replace(/\bis visible in this connection is on full display\b/g, 'is on full display in this connection');
  r = r.replace(
    /\bat maximum distance\. The gap between ([^.]+?)\./g,
    'at maximum distance, and the gap between $1 is on full display.'
  );
  r = r.replace(
    /\bthan on an ordinary day\. The structural gap between ([^.]+?) in this connection, /g,
    'than on an ordinary day. This makes visible the structural gap between $1 in this connection, '
  );
  r = r.replace(
    /\bwhen the transit field doesn't support it\b/gi,
    "when the geometry doesn't support it"
  );
  r = r.replace(
    /\bthat the transit field isn't supporting right now\b/gi,
    "that the geometry isn't supporting right now"
  );
  r = r.replace(/, threading doubled \w+ frequencies through this connection\.?\s*/gi, '. ');
  r = r.replace(
    /, transiting \w+ (?:meets natal \w+ at the same degree|is meeting natal \w+ at the same degree|is at friction point with natal \w+) between these charts today/gi,
    ''
  );
  r = r.replace(/\bMaking visible the gap between /g, 'The gap between ');
  r = r.replace(
    /\bat maximum distance\. The gap between ([^.]+?)\./g,
    'at maximum distance, and the gap between $1 is on full display.'
  );
  return r.replace(/\s+/g, ' ').trim();
}

export function surgicalFeed(key: string, original: string): string {
  const spec = parseKey(key);
  const maps = allMaps();
  const sentences = splitSentences(original);
  const out: string[] = [];
  const forcedOpener = resolveOpener(key, spec);
  const hasMappedOpener = Boolean(maps.opposition[key] || maps.trine[key] || maps.sextile[key]);
  const useForced =
    hasMappedOpener ||
    spec.aspect === 'opposition' ||
    spec.aspect === 'sextile' ||
    spec.aspect === 'trine' ||
    Boolean(maps.trine[key] || maps.sextile[key]);

  let namedUsed = false;
  let startIdx = 0;

  if (
    useForced &&
    (hasMappedOpener ||
      hasVagueShell(sentences[0] ?? '') ||
      isTemplateOpener(sentences[0] ?? '') ||
      /\bat opposite poles\b/i.test(sentences[0] ?? '') ||
      /\bface each other across maximum distance\b/i.test(sentences[0] ?? ''))
  ) {
    out.push(forcedOpener);
    namedUsed = true;
    startIdx = 1;
  }

  for (let i = startIdx; i < sentences.length; i++) {
    const s = sentences[i]!;

    if (!namedUsed && i === 0) {
      if (openerAlreadyNamesBodies(s, spec.t, spec.n)) {
        out.push(s);
        namedUsed = true;
        continue;
      }
      if (hasVagueShell(s) || isTemplateOpener(s)) {
        const stripped = stripVagueShell(s);
        if (stripped.length > 10) {
          const joiner = stripped.endsWith(',') || stripped.endsWith(', ') ? ' ' : ', ';
          out.push(`${forcedOpener}${joiner}${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`);
        } else {
          out.push(`${forcedOpener}.`);
        }
        namedUsed = true;
        continue;
      }
    }

    if (hasVagueShell(s)) {
      const stripped = stripVagueShell(s);
      if (stripped.length > 8) out.push(stripped);
      continue;
    }

    out.push(s);
  }

  if (!namedUsed) out.unshift(`${forcedOpener}.`);

  return polishFeed(joinParts(out));
}

export function extractFeedsFromSource(src: string): Map<string, string> {
  const map = new Map<string, string>();
  const keyRe = /^\s+([A-Z][A-Z0-9_]+):\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(src)) !== null) {
    const key = m[1]!;
    const slice = src.slice(m.index, m.index + 20000);
    const feedM = slice.match(/feed:\s*`([^`]+)`/);
    if (feedM) map.set(key, feedM[1]!);
  }
  return map;
}

function processFile(relPath: string, reviewName: string, label: string): number {
  const target = path.join(__dirname, '../projection/insight-library', relPath);
  const review = path.join(__dirname, reviewName);
  const oldSrc = execSync(`git show ${OLD_COMMIT}:vnext/projection/insight-library/${relPath}`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const originals = extractFeedsFromSource(oldSrc);
  let txt = fs.readFileSync(target, 'utf8');

  for (const [key, original] of originals) {
    const escapedOrig = original.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const re = new RegExp(
      `(\\s+${key}:\\s*\\{[\\s\\S]*?feed:\\s*)\`[\\s\\S]*?\`(\\s*,\\s*\\n\\s*sonic:)`,
      'm'
    );
    txt = txt.replace(re, `$1\`${escapedOrig}\`$2`);
  }

  const lines: string[] = [
    `# ${label} , surgical feed edits`,
    '',
    `Source: \`${OLD_COMMIT}\`. Outer-planet voice; varied opposition openers.`,
    '',
  ];

  let n = 0;
  for (const [key, original] of originals) {
    const edited = surgicalFeed(key, original);
    const escaped = edited.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const re = new RegExp(
      `(\\s+${key}:\\s*\\{[\\s\\S]*?feed:\\s*)\`[\\s\\S]*?\`(\\s*,\\s*\\n\\s*sonic:)`,
      'm'
    );
    const next = txt.replace(re, `$1\`${escaped}\`$2`);
    if (next === txt) console.error(`WARN: no replace for ${key}`);
    else {
      txt = next;
      n++;
    }

    lines.push(`## ${key}`);
    lines.push('');
    lines.push('**Before**');
    lines.push('');
    lines.push(`> ${original}`);
    lines.push('');
    lines.push('**After**');
    lines.push('');
    lines.push(`> ${edited}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  fs.writeFileSync(target, txt);
  fs.writeFileSync(review, lines.join('\n'));
  return n;
}

function main() {
  if (process.argv.includes('--samples')) {
    for (const key of SAMPLE_KEYS) {
      const rel = SAMPLE_SOURCES[key]!;
      const oldSrc = execSync(`git show ${OLD_COMMIT}:vnext/projection/insight-library/${rel}`, {
        cwd: ROOT,
        encoding: 'utf8',
      });
      const before = extractFeedsFromSource(oldSrc).get(key);
      if (!before) {
        console.error(`Missing ${key}`);
        continue;
      }
      console.log(`\n## ${key}\n`);
      console.log('BEFORE:\n', before);
      console.log('\nAFTER:\n', surgicalFeed(key, before));
    }
    return;
  }

  let total = 0;
  for (const t of TARGETS) {
    const n = processFile(t.file, t.review, t.label);
    console.log(`Updated ${n} feeds in ${t.label}`);
    total += n;
  }
  console.log(`Total: ${total} feeds`);
}

main();
