/**
 * Batch 7B — surgical mercury.ts feeds from 899e0a2 prose.
 * Run: npx tsx vnext/scripts/surgical-mercury-feed-7b.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.join(__dirname, '../..');
const TARGET = path.join(__dirname, '../projection/insight-library/insight-library-aspects-mercury.ts');
const REVIEW = path.join(__dirname, 'mercury-feed-surgical-review.md');
const OLD_COMMIT = '899e0a2';
const OLD_PATH = 'vnext/projection/insight-library/insight-library-aspects-mercury.ts';

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

/** Varied opposition openers — not copied from personal.ts patterns. */
const OPPOSITION_OPENER: Record<string, string> = {
  SUN_MERCURY_OPPOSITION:
    'Sun and Mercury span the identity–mind axis at full polarity between these charts today',
  MOON_MERCURY_OPPOSITION:
    'Moon and Mercury pull from opposite poles between these charts today',
  MERCURY_VENUS_OPPOSITION:
    'Mercury and Venus sit at opposite ends of the clarity–grace axis between these charts today',
  MERCURY_MARS_OPPOSITION:
    'Mercury opposes Mars across these charts today—thought and action on opposite ends of the field.',
  MERCURY_MERCURY_OPPOSITION:
    'Mercury and Mercury sit on opposite ends of the mental axis between these charts today',
  SATURN_MERCURY_OPPOSITION:
    'Saturn and Mercury stand at opposing ends of the discipline–fluency axis between these charts today',
  JUPITER_MERCURY_OPPOSITION:
    'Jupiter and Mercury occupy opposite ends of the vision–precision spectrum between these charts today',
  URANUS_MERCURY_OPPOSITION:
    'Uranus and Mercury pull in opposite directions between these charts today',
  NEPTUNE_MERCURY_OPPOSITION:
    'Neptune and Mercury occupy opposing ends of the meaning–language axis between these charts today',
  PLUTO_MERCURY_OPPOSITION:
    'Pluto and Mercury face each other across the depth–clarity divide between these charts today',
};

/** Limit repetitive "Transiting X forms a sextile to natal Y" (max ~2 use default). */
const SEXTILE_OPENER: Record<string, string> = {
  SUN_MERCURY_SEXTILE:
    'Transiting Sun forms a sextile to natal Mercury between these charts today',
  MOON_MERCURY_SEXTILE:
    'Moon and Mercury open an easy channel between these charts today',
  MERCURY_VENUS_SEXTILE:
    'Mercury and Venus find cooperative ground between these charts today',
  MERCURY_MARS_SEXTILE:
    'Mercury eases the passage to Mars between these charts today',
  SATURN_MERCURY_SEXTILE:
    'Saturn and Mercury open a disciplined channel between these charts today',
  JUPITER_MERCURY_SEXTILE:
    'Transiting Jupiter forms a sextile to natal Mercury between these charts today',
  URANUS_MERCURY_SEXTILE:
    'Uranus and Mercury spark a productive exchange between these charts today',
  NEPTUNE_MERCURY_SEXTILE:
    'Neptune and Mercury soften the boundary between feeling and wording between these charts today',
  PLUTO_MERCURY_SEXTILE:
    'Pluto and Mercury open a channel for difficult truth to find words between these charts today',
};

function capBody(b: string): string {
  return BODY_LABEL[b.toLowerCase()] ?? b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

function parseKey(key: string): { t: string; n: string; aspect: string; same: boolean } {
  const m = key.match(/^([A-Z]+)_([A-Z]+)_(CONJUNCTION|SEXTILE|SQUARE|TRINE|OPPOSITION)$/);
  if (!m) throw new Error(`bad key ${key}`);
  const t = m[1]!.toLowerCase();
  const n = m[2]!.toLowerCase();
  return { t, n, aspect: m[3]!.toLowerCase(), same: t === n };
}

function defaultOpener(spec: ReturnType<typeof parseKey>): string {
  const T = capBody(spec.t);
  const N = capBody(spec.n);
  if (spec.same) {
    switch (spec.aspect) {
      case 'conjunction':
        return `Mercury meets Mercury at the same degree between these charts today`;
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
      return `${T} and ${N} are at friction between these charts today`;
    case 'trine':
      return `Transiting ${T} trines natal ${N} between these charts today`;
    case 'opposition':
      return `${T} and ${N} face each other across maximum distance between these charts today`;
    default:
      return `Transiting ${T} aspects natal ${N} between these charts today`;
  }
}

function resolveOpener(key: string, spec: ReturnType<typeof parseKey>): string {
  if (spec.aspect === 'opposition' && OPPOSITION_OPENER[key]) return OPPOSITION_OPENER[key]!;
  if (spec.aspect === 'sextile' && SEXTILE_OPENER[key]) return SEXTILE_OPENER[key]!;
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
    /\bdoubled \w+ frequencies\b/i.test(s) ||
    /\bthreading (?:doubled )?\w+ frequencies\b/i.test(s) ||
    /\bMercurial frequencies\b/i.test(s) ||
    /\bsolar and Mercurial\b/i.test(s)
  );
}

function stripVagueShell(s: string): string {
  let r = s.trim();
  r = r.replace(/^The current sky is threading [^.]+?\.\s*/i, '');
  r = r.replace(/^The current sky is /i, '');
  r = r.replace(/^Today's transits are /i, '');
  r = r.replace(/^Today's transit field is /i, '');
  r = r.replace(/^A transit is /i, '');
  r = r.replace(/^The current sky is opening a window where /i, '');
  r = r.replace(/^Opening a window where /i, '');
  r = r.replace(/^The current sky is making visible the tension between /i, 'The tension between ');
  r = r.replace(/^The current sky is making visible the gap between /i, 'The gap between ');
  r = r.replace(/^The current sky is making visible /i, '');
  r = r.replace(/^Making visible the tension between /i, 'The tension between ');
  r = r.replace(/^Making visible /i, '');
  r = r.replace(/^Amplifying how easily /i, '');
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
    /^A transit is/i.test(s)
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

/** Fix strip artifacts and sentence fragments left after vague-shell removal. */
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
  r = r.replace(
    /\bat maximum distance\. The gap between how each person thinks and communicates\./g,
    'at maximum distance, and the gap between how each person thinks and communicates is on full display.'
  );
  r = r.replace(
    /\bat maximum distance\. The gap between what can be said and what feels beautiful\./g,
    'at maximum distance, and the gap between what can be said and what feels beautiful is on full display.'
  );
  r = r.replace(
    /\bat maximum distance\. The gap between what can be said and what needs to be done\./g,
    'at maximum distance, and the gap between what can be said and what needs to be done is on full display.'
  );
  r = r.replace(
    /\bat maximum distance\. The gap between what's felt and what can be articulated\./g,
    "at maximum distance, and the gap between what's felt and what can be articulated is on full display."
  );
  r = r.replace(
    /\bThe tension between different thought processes\./g,
    'The tension between different thought processes is visible.'
  );
  r = r.replace(
    /\bThe tension between breakthrough and articulation\./g,
    'The tension between breakthrough and articulation is visible.'
  );
  r = r.replace(
    /\bThe tension between mysticism and clarity\./g,
    'The tension between mysticism and clarity is visible.'
  );
  r = r.replace(
    /\bThe tension between depth and clarity\./g,
    'The tension between depth and clarity is visible.'
  );
  r = r.replace(
    /\bat maximum distance\. The gap between revolutionary insight and articulate expression\./g,
    'at maximum distance. The gap between revolutionary insight and articulate expression is on full display.'
  );
  r = r.replace(
    /\bat maximum distance\. The gap between depth and articulation\./g,
    'at maximum distance. The gap between depth and articulation is visible between these charts.'
  );
  r = r.replace(
    /\bthan on an ordinary day\. The structural gap between articulation and action in this connection—/g,
    'than on an ordinary day. This makes visible the structural gap between articulation and action in this connection—'
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

function surgicalFeed(key: string, original: string): string {
  const spec = parseKey(key);
  const sentences = splitSentences(original);
  const out: string[] = [];
  const forcedOpener = resolveOpener(key, spec);
  const useForced =
    spec.aspect === 'opposition' ||
    spec.aspect === 'sextile' ||
    OPPOSITION_OPENER[key] ||
    SEXTILE_OPENER[key];

  let namedUsed = false;
  let startIdx = 0;

  if (useForced && (hasVagueShell(sentences[0] ?? '') || isTemplateOpener(sentences[0] ?? ''))) {
    out.push(forcedOpener);
    namedUsed = true;
    startIdx = 1;
    if (sentences[0] && !hasVagueShell(sentences[0])) {
      const tail = stripVagueShell(sentences[0]);
      if (tail.length > 20 && !isTemplateOpener(tail)) {
        const joiner = tail.endsWith(',') || tail.endsWith('—') ? ' ' : ', ';
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
          const joiner = stripped.endsWith(',') || stripped.endsWith('—') ? ' ' : ', ';
          out.push(`${forcedOpener}${joiner}${stripped.charAt(0).toLowerCase()}${stripped.slice(1)}`);
        } else if (/same pitch|same degree/i.test(sentences.join(' '))) {
          out.push(`${forcedOpener}.`);
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

function extractFeedsFromSource(src: string): Map<string, string> {
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

function main() {
  const oldSrc = execSync(`git show ${OLD_COMMIT}:${OLD_PATH}`, { cwd: ROOT, encoding: 'utf8' });
  const originals = extractFeedsFromSource(oldSrc);
  let txt = fs.readFileSync(TARGET, 'utf8');

  for (const [key, original] of originals) {
    const escapedOrig = original.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const re = new RegExp(
      `(\\s+${key}:\\s*\\{[\\s\\S]*?feed:\\s*)\`[\\s\\S]*?\`(\\s*,\\s*\\n\\s*sonic:)`,
      'm'
    );
    txt = txt.replace(re, `$1\`${escapedOrig}\`$2`);
  }

  const lines: string[] = [
    '# mercury.ts — surgical feed edits (50 entries)',
    '',
    `Source: \`${OLD_COMMIT}\`. Opposition/sextile openers varied for mercury voice.`,
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

  fs.writeFileSync(TARGET, txt);
  fs.writeFileSync(REVIEW, lines.join('\n'));
  console.log(`Updated ${n}/${originals.size} feeds in mercury.ts`);
  console.log(`Review: ${REVIEW}`);
}

main();
