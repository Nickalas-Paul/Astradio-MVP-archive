/**
 * Batch 7C , surgical jupiter.ts + saturn.ts feeds from 899e0a2 prose.
 * Run: npx tsx vnext/scripts/surgical-jupiter-saturn-feed-7c.ts
 * Preview 3 jupiter samples: npx tsx vnext/scripts/surgical-jupiter-saturn-feed-7c.ts --samples
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.join(__dirname, '../..');
const OLD_COMMIT = '899e0a2';

const TARGETS = [
  {
    file: 'insight-library-aspects-jupiter.ts',
    review: 'jupiter-feed-surgical-review.md',
    label: 'jupiter.ts',
  },
  {
    file: 'insight-library-aspects-saturn.ts',
    review: 'saturn-feed-surgical-review.md',
    label: 'saturn.ts',
  },
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

/** Jupiter file , varied opposition openers (not personal/mercury templates). */
const JUPITER_OPPOSITION_OPENER: Record<string, string> = {
  JUPITER_SUN_OPPOSITION:
    'Jupiter and Sun span the identity–horizon axis at full polarity between these charts today',
  JUPITER_MOON_OPPOSITION:
    'Jupiter and Moon pull from opposite ends of the nourishment–expansion spectrum between these charts today',
  JUPITER_VENUS_OPPOSITION:
    'Jupiter and Venus sit at opposing ends of the abundance–beauty axis between these charts today',
  JUPITER_MARS_OPPOSITION:
    'Jupiter opposes Mars across these charts today, vision and impulse on opposite ends of the field.',
  JUPITER_JUPITER_OPPOSITION:
    'Jupiter and Jupiter occupy opposite ends of the meaning–scale axis between these charts today',
  SATURN_JUPITER_OPPOSITION:
    'Saturn and Jupiter face opposite demands between these charts today, structure versus growth',
  URANUS_JUPITER_OPPOSITION:
    'Uranus and Jupiter pull innovation and optimism in opposite directions between these charts today',
  NEPTUNE_JUPITER_OPPOSITION:
    'Neptune and Jupiter span the dissolve–expand polarity between these charts today',
  PLUTO_JUPITER_OPPOSITION:
    'Pluto and Jupiter stand on opposite sides of the depth–abundance divide between these charts today',
};

const JUPITER_SEXTILE_OPENER: Record<string, string> = {
  JUPITER_SUN_SEXTILE:
    'Jupiter and Sun open a cooperative channel between these charts today',
  JUPITER_MOON_SEXTILE:
    'Jupiter and Moon find easy ground between emotional warmth and hopeful breadth between these charts today',
  JUPITER_VENUS_SEXTILE:
    'Jupiter and Venus cooperate between generosity and beauty between these charts today',
  JUPITER_MARS_SEXTILE:
    'Jupiter eases the passage to Mars between these charts today',
  SATURN_JUPITER_SEXTILE:
    'Saturn and Jupiter open a disciplined channel for sustainable growth between these charts today',
};

const JUPITER_TRINE_OPENER: Record<string, string> = {
  JUPITER_VENUS_TRINE:
    'Jupiter and Venus draw from the same abundance–beauty current between these charts today',
  JUPITER_SUN_TRINE:
    'Jupiter and Sun flow in natural harmony between these charts today',
  JUPITER_MOON_TRINE:
    'Jupiter and Moon reinforce each other between faith and feeling between these charts today',
};

/** Saturn file , varied opposition openers. */
const SATURN_OPPOSITION_OPENER: Record<string, string> = {
  SATURN_SUN_OPPOSITION:
    'Saturn and Sun span the identity–structure axis at full polarity between these charts today',
  SATURN_MOON_OPPOSITION:
    'Saturn and Moon pull from opposite ends of the duty–need spectrum between these charts today',
  SATURN_VENUS_OPPOSITION:
    'Saturn and Venus sit at opposing ends of the commitment–pleasure axis between these charts today',
  SATURN_MARS_OPPOSITION:
    'Saturn opposes Mars across these charts today, restraint and impulse on opposite ends of the field.',
  SATURN_SATURN_OPPOSITION:
    'Saturn and Saturn occupy opposite ends of the obligation–freedom axis between these charts today',
  URANUS_SATURN_OPPOSITION:
    'Uranus and Saturn pull change and structure in opposite directions between these charts today',
  NEPTUNE_SATURN_OPPOSITION:
    'Neptune and Saturn span the dissolve–form polarity between these charts today',
  PLUTO_SATURN_OPPOSITION:
    'Pluto and Saturn stand on opposite sides of the depth–boundary divide between these charts today',
};

const SATURN_SEXTILE_OPENER: Record<string, string> = {
  SATURN_SUN_SEXTILE: 'Saturn and Sun open a productive channel between these charts today',
  SATURN_MOON_SEXTILE:
    'Saturn and Moon find cooperative ground between structure and feeling between these charts today',
};

const SAMPLE_KEYS = [
  'JUPITER_SUN_OPPOSITION',
  'JUPITER_MOON_SQUARE',
  'JUPITER_VENUS_TRINE',
];

export function capBody(b: string): string {
  return BODY_LABEL[b.toLowerCase()] ?? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

export function parseKey(key: string): { t: string; n: string; aspect: string; same: boolean } {
  const m = key.match(/^([A-Z]+)_([A-Z]+)_(CONJUNCTION|SEXTILE|SQUARE|TRINE|OPPOSITION)$/);
  if (!m) throw new Error(`bad key ${key}`);
  const t = m[1]!.toLowerCase();
  const n = m[2]!.toLowerCase();
  return { t, n, aspect: m[3]!.toLowerCase(), same: t === n };
}

function allMaps() {
  return {
    opposition: { ...JUPITER_OPPOSITION_OPENER...SATURN_OPPOSITION_OPENER },
    sextile: { ...JUPITER_SEXTILE_OPENER...SATURN_SEXTILE_OPENER },
    trine: { ...JUPITER_TRINE_OPENER },
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
        return `${T} and ${N} are at friction between these charts today`;
      case 'trine':
        return `${T} trines ${N} between these charts today`;
      case 'opposition':
        return `${T} and ${N} face each other across maximum distance between these charts today`;
      default:
        return `${T} aspects ${N} between these charts today`;
    }
  }
  switch (spec.aspect) {
    case 'conjunction':
      return `Transiting ${T} meets natal ${N} at the same degree between these charts today`;
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
  if (spec.aspect === 'sextile' && maps.sextile[key]) return maps.sextile[key]!;
  if (spec.aspect === 'trine' && maps.trine[key]) return maps.trine[key]!;
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
    /\bJupiter's transit\b/i.test(s) ||
    /\bSaturn's transit\b/i.test(s) ||
    /\bJupiter'?s transit is\b/i.test(s) ||
    /\bSaturn'?s transit is\b/i.test(s) ||
    /\bdoubled \w+ frequencies\b/i.test(s)
  );
}

function stripVagueShell(s: string): string {
  let r = s.trim();
  r = r.replace(/^The current sky is threading [^.]+?\.\s*/i, '');
  r = r.replace(/^The current sky is /i, '');
  r = r.replace(/^Today's transits are /i, '');
  r = r.replace(/^Today's transit field is /i, '');
  r = r.replace(/^A transit is /i, '');
  r = r.replace(/^Jupiter's transit is illuminating both ends of /i, '');
  r = r.replace(/^Jupiter's transit is illuminating /i, '');
  r = r.replace(/^Jupiter's transit is pressing on /i, 'pressing on ');
  r = r.replace(/^Jupiter's transit is /i, '');
  r = r.replace(/^Saturn's transit is /i, '');
  r = r.replace(/^The current sky is opening a window where /i, '');
  r = r.replace(/^Opening a window where /i, '');
  r = r.replace(/^The current sky is making visible the tension between /i, 'The tension between ');
  r = r.replace(/^The current sky is making visible the gap between /i, 'The gap between ');
  r = r.replace(/^The current sky is making visible /i, '');
  r = r.replace(/^Making visible the tension between /i, 'The tension between ');
  r = r.replace(/^Making visible /i, '');
  r = r.replace(/^Amplifying how easily /i, '');
  r = r.replace(/^The current sky is amplifying the natural beauty and relational abundance available in this connection\.\s*/i, '');
  r = r.replace(/^The current sky is amplifying /i, '');
  r = r.replace(/^The current sky is activating /i, '');
  r = r.replace(/^The current sky is illuminating /i, '');
  r = r.replace(/^The current sky is pressing on /i, 'pressing on ');
  r = r.trim();
  if (r && /^[a-z]/.test(r)) r = r.charAt(0).toUpperCase() + r.slice(1);
  return r;
}

function openerAlreadyNamesBodies(s: string, t: string, n: string): boolean {
  const low = s.toLowerCase();
  return (
    new RegExp(`\\b${t}\\b`, 'i').test(low) &&
    new RegExp(`\\b${n}\\b`, 'i').test(low) &&
    !hasVagueShell(s)
  );
}

function isTemplateOpener(s: string): boolean {
  return (
    /^Transiting \w+ (meets|forms|opposes|trines)/i.test(s) ||
    /^The current sky/i.test(s) ||
    /^Today's transit/i.test(s) ||
    /^A transit is/i.test(s) ||
    /^Jupiter's transit/i.test(s) ||
    /^Saturn's transit/i.test(s)
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
  r = r.replace(/\bfield One person's\b/g, "field. One person's");
  r = r.replace(
    /\bwhen the transit field doesn't support it\b/gi,
    "when the geometry doesn't support it"
  );
  r = r.replace(
    /\bthat the transit field isn't supporting right now\b/gi,
    "that the geometry isn't supporting right now"
  );
  return r.replace(/\s+/g, ' ').trim();
}

export function surgicalFeed(key: string, original: string): string {
  const spec = parseKey(key);
  const maps = allMaps();
  const sentences = splitSentences(original);
  const out: string[] = [];
  const forcedOpener = resolveOpener(key, spec);
  const hasMappedOpener = Boolean(maps.opposition[key]);
  const useForced =
    hasMappedOpener ||
    spec.aspect === 'opposition' ||
    spec.aspect === 'sextile' ||
    spec.aspect === 'trine' ||
    maps.sextile[key] ||
    maps.trine[key];

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
    if (sentences[0] && !hasVagueShell(sentences[0])) {
      const tail = stripVagueShell(sentences[0]);
      if (tail.length > 20 && !isTemplateOpener(tail)) {
        const joiner = tail.endsWith(',') || tail.endsWith(', ') ? ' ' : ', ';
        out[0] = `${forcedOpener}${joiner}${tail.charAt(0).toLowerCase()}${tail.slice(1)}`;
      }
    }
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

function processFile(
  relPath: string,
  reviewName: string,
  label: string,
  onlyKeys?: Set<string>
): number {
  const target = path.join(__dirname, '../projection/insight-library', relPath);
  const review = path.join(__dirname, reviewName);
  const oldSrc = execSync(`git show ${OLD_COMMIT}:vnext/projection/insight-library/${relPath}`, {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const originals = extractFeedsFromSource(oldSrc);
  let txt = fs.readFileSync(target, 'utf8');

  for (const [key, original] of originals) {
    if (onlyKeys && !onlyKeys.has(key)) continue;
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
    `Source: \`${OLD_COMMIT}\`. Jupiter/Saturn voice; varied opposition openers.`,
    '',
  ];

  let n = 0;
  for (const [key, original] of originals) {
    if (onlyKeys && !onlyKeys.has(key)) continue;
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

  if (!onlyKeys) {
    fs.writeFileSync(target, txt);
    fs.writeFileSync(review, lines.join('\n'));
  }
  return n;
}

function main() {
  const samplesOnly = process.argv.includes('--samples');

  if (samplesOnly) {
    const oldSrc = execSync(
      `git show ${OLD_COMMIT}:vnext/projection/insight-library/insight-library-aspects-jupiter.ts`,
      { cwd: ROOT, encoding: 'utf8' }
    );
    const originals = extractFeedsFromSource(oldSrc);
    for (const key of SAMPLE_KEYS) {
      const before = originals.get(key);
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
