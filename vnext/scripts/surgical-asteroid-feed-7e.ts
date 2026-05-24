/**
 * Batch 7E — surgical asteroid feeds (ceres, chiron, juno, pallas, vesta) from 899e0a2 prose.
 * Run: npx tsx vnext/scripts/surgical-asteroid-feed-7e.ts
 * Preview samples: npx tsx vnext/scripts/surgical-asteroid-feed-7e.ts --samples
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.join(__dirname, '../..');
const OLD_COMMIT = '899e0a2';

const TARGETS = [
  { file: 'insight-library-aspects-ceres.ts', review: 'ceres-feed-surgical-review.md', label: 'ceres.ts' },
  { file: 'insight-library-aspects-chiron.ts', review: 'chiron-feed-surgical-review.md', label: 'chiron.ts' },
  { file: 'insight-library-aspects-juno.ts', review: 'juno-feed-surgical-review.md', label: 'juno.ts' },
  { file: 'insight-library-aspects-pallas.ts', review: 'pallas-feed-surgical-review.md', label: 'pallas.ts' },
  { file: 'insight-library-aspects-vesta.ts', review: 'vesta-feed-surgical-review.md', label: 'vesta.ts' },
] as const;

const BODY_LABEL: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  mercury: 'Mercury',
  venus: 'Venus',
  mars: 'Mars',
  ceres: 'Ceres',
  chiron: 'Chiron',
  juno: 'Juno',
  pallas: 'Pallas',
  vesta: 'Vesta',
};

const OPPOSITION_OPENER: Record<string, string> = {
  CERES_SUN_OPPOSITION:
    'Ceres and Sun span the identity–nurture axis at full polarity between these charts today',
  CERES_MOON_OPPOSITION:
    'Ceres and Moon pull from opposite ends of the tending–feeling spectrum between these charts today',
  CERES_VENUS_OPPOSITION:
    'Ceres and Venus sit at opposing ends of the care–beauty axis between these charts today',
  CERES_MARS_OPPOSITION:
    'Ceres opposes Mars across these charts today—nurture and drive on opposite ends of the field.',
  CHIRON_SUN_OPPOSITION:
    'Chiron and Sun span the identity–wound axis at full polarity between these charts today',
  CHIRON_MOON_OPPOSITION:
    'Chiron and Moon pull from opposite ends of the safety–healing spectrum between these charts today',
  CHIRON_VENUS_OPPOSITION:
    'Chiron and Venus sit at opposing ends of the wound–grace axis between these charts today',
  CHIRON_MARS_OPPOSITION:
    'Chiron opposes Mars across these charts today—healing and force on opposite ends of the field.',
  JUNO_SUN_OPPOSITION:
    'Juno and Sun span the identity–partnership axis at full polarity between these charts today',
  JUNO_MOON_OPPOSITION:
    'Juno and Moon pull from opposite ends of the bond–need spectrum between these charts today',
  JUNO_VENUS_OPPOSITION:
    'Juno and Venus sit at opposing ends of the commitment–pleasure axis between these charts today',
  JUNO_MARS_OPPOSITION:
    'Juno opposes Mars across these charts today—contract and impulse on opposite ends of the field.',
  PALLAS_SUN_OPPOSITION:
    'Pallas and Sun span the identity–strategy axis at full polarity between these charts today',
  PALLAS_MOON_OPPOSITION:
    'Pallas and Moon pull from opposite ends of the pattern–feeling spectrum between these charts today',
  PALLAS_VENUS_OPPOSITION:
    'Pallas and Venus sit at opposing ends of the wisdom–harmony axis between these charts today',
  PALLAS_MARS_OPPOSITION:
    'Pallas opposes Mars across these charts today—strategy and action on opposite ends of the field.',
  VESTA_SUN_OPPOSITION:
    'Vesta and Sun span the identity–devotion axis at full polarity between these charts today',
  VESTA_MOON_OPPOSITION:
    'Vesta and Moon pull from opposite ends of the sanctuary–need spectrum between these charts today',
  VESTA_VENUS_OPPOSITION:
    'Vesta and Venus sit at opposing ends of the sacred–pleasure axis between these charts today',
  VESTA_MARS_OPPOSITION:
    'Vesta opposes Mars across these charts today—focus and drive on opposite ends of the field.',
};

const TRINE_OPENER: Record<string, string> = {
  JUNO_VENUS_TRINE:
    'Juno and Venus draw from the same commitment–beauty current between these charts today',
  CERES_MOON_TRINE:
    'Ceres and Moon flow together between tending and feeling between these charts today',
  CHIRON_SUN_TRINE: 'Chiron and Sun flow in natural harmony between these charts today',
};

const SAMPLE_KEYS = ['CERES_SUN_OPPOSITION', 'CHIRON_MOON_SQUARE', 'JUNO_VENUS_TRINE'];

const SAMPLE_SOURCES: Record<string, string> = {
  CERES_SUN_OPPOSITION: 'insight-library-aspects-ceres.ts',
  CHIRON_MOON_SQUARE: 'insight-library-aspects-chiron.ts',
  JUNO_VENUS_TRINE: 'insight-library-aspects-juno.ts',
};

function capBody(b: string): string {
  return BODY_LABEL[b.toLowerCase()] ?? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

function parseKey(key: string): { t: string; n: string; aspect: string; same: boolean } {
  const m = key.match(/^([A-Z]+)_([A-Z]+)_(CONJUNCTION|SEXTILE|SQUARE|TRINE|OPPOSITION)$/);
  if (!m) throw new Error(`bad key ${key}`);
  return { t: m[1]!.toLowerCase(), n: m[2]!.toLowerCase(), aspect: m[3]!.toLowerCase(), same: m[1] === m[2] };
}

function resolveOpener(key: string, spec: ReturnType<typeof parseKey>): string {
  if (spec.aspect === 'opposition' && OPPOSITION_OPENER[key]) return OPPOSITION_OPENER[key]!;
  if (spec.aspect === 'trine' && TRINE_OPENER[key]) return TRINE_OPENER[key]!;
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
      return `${T} and ${N} open a cooperative channel between these charts today`;
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
    (/\bthis person's\b/i.test(s) && !/\bbetween these charts\b/i.test(s)) ||
    (/\bthis connection today\b/i.test(s) && !/\bbetween these charts\b/i.test(s))
  );
}

function stripVagueShell(s: string): string {
  let r = s.trim();
  r = r.replace(/^The current sky is /i, '');
  r = r.replace(/^Today's transits are lighting both ends of /i, '');
  r = r.replace(/^Today's transit field is /i, '');
  r = r.replace(/^Today's transits are /i, '');
  r = r.replace(/^A transit is pressing on /i, 'pressing on ');
  r = r.replace(/^A transit is /i, '');
  r = r.replace(/^The current sky is amplifying /i, '');
  r = r.replace(/^The current sky is making visible /i, '');
  r = r.replace(/^Making visible /i, '');
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
    /^A transit\b/i.test(s)
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
    /\bwhen the transit field doesn't support it\b/gi,
    "when the geometry doesn't support it"
  );
  r = r.replace(/, threading doubled \w+ frequencies through this connection\.?\s*/gi, '. ');
  r = r.replace(
    /, transiting \w+ (?:meets natal \w+ at the same degree|is meeting natal \w+ at the same degree|is at friction point with natal \w+) between these charts today/gi,
    ''
  );
  r = r.replace(/\bMaking visible the gap between /g, 'The gap between ');
  return r.replace(/\s+/g, ' ').trim();
}

export function surgicalFeed(key: string, original: string): string {
  const spec = parseKey(key);
  const sentences = splitSentences(original);
  const out: string[] = [];
  const forcedOpener = resolveOpener(key, spec);
  const hasMappedOpener = Boolean(OPPOSITION_OPENER[key] || TRINE_OPENER[key]);
  const useForced =
    hasMappedOpener ||
    spec.aspect === 'opposition' ||
    spec.aspect === 'trine' ||
    Boolean(TRINE_OPENER[key]);

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
          const joiner = stripped.endsWith(',') || stripped.endsWith('—') ? ' ' : ', ';
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
    `# ${label} — surgical feed edits`,
    '',
    `Source: \`${OLD_COMMIT}\`. Asteroid-specific voice; varied opposition openers.`,
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
