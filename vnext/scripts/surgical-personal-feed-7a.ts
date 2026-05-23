/**
 * Roll back personal.ts feeds to 899e0a2 prose, apply surgical opener edits.
 * Writes: personal.ts (updated), personal-feed-surgical-review.md (50 before/after)
 * Run: npx tsx vnext/scripts/surgical-personal-feed-7a.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ROOT = path.join(__dirname, '../..');
const TARGET = path.join(__dirname, '../projection/insight-library/insight-library-aspects-personal.ts');
const REVIEW = path.join(__dirname, 'personal-feed-surgical-review.md');
const OLD_COMMIT = '899e0a2';

const BODY_LABEL: Record<string, string> = {
  sun: 'Sun',
  moon: 'Moon',
  venus: 'Venus',
  mars: 'Mars',
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

/** Named opener — varied but audit-safe (\\bbody\\b word match). */
function namedOpener(spec: ReturnType<typeof parseKey>): string {
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
      return `${T} and ${N} are at friction between these charts today`;
    case 'trine':
      return `Transiting ${T} trines natal ${N} between these charts today`;
    case 'opposition':
      return `${T} and ${N} face each other across maximum distance between these charts today`;
    default:
      return `Transiting ${T} aspects natal ${N} between these charts today`;
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
    /\bdoubled \w+ frequencies\b/i.test(s) ||
    /\bthreading (?:doubled )?\w+ frequencies\b/i.test(s)
  );
}

function stripVagueShell(s: string): string {
  let r = s.trim();
  r = r.replace(/^The current sky is threading doubled \w+ frequencies through this connection\.\s*/i, '');
  r = r.replace(/^The current sky is threading [^.]+?\.\s*/i, '');
  r = r.replace(/^The current sky is /i, '');
  r = r.replace(/^Today's transits are /i, '');
  r = r.replace(/^Today's transit field is /i, '');
  r = r.replace(/^Today's transit is /i, '');
  r = r.replace(/^A transit is /i, '');
  r = r.replace(/^The current sky is opening a window where /i, '');
  r = r.replace(/^Opening a window where /i, '');
  r = r.replace(/^The current sky is making visible /i, '');
  r = r.replace(/^The current sky is amplifying /i, '');
  r = r.replace(/^The current sky is activating /i, '');
  r = r.replace(/^The current sky is illuminating /i, '');
  r = r.replace(/^The current sky is pressing on /i, 'pressing on ');
  r = r.trim();
  if (r && r[0] === r[0].toLowerCase() && /^[a-z]/.test(r)) {
    r = r.charAt(0).toUpperCase() + r.slice(1);
  }
  return r;
}

function openerAlreadyNamesBodies(s: string, t: string, n: string): boolean {
  const low = s.toLowerCase();
  const hasT = new RegExp(`\\b${t}\\b`, 'i').test(low);
  const hasN = new RegExp(`\\b${n}\\b`, 'i').test(low);
  return hasT && hasN && !hasVagueShell(s);
}

function joinParts(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function surgicalFeed(key: string, original: string): string {
  const spec = parseKey(key);
  const sentences = splitSentences(original);
  if (sentences.length === 0) return original;

  const out: string[] = [];
  let namedUsed = false;

  for (let i = 0; i < sentences.length; i++) {
    let s = sentences[i]!;

    if (i === 0 && hasVagueShell(s) && !openerAlreadyNamesBodies(s, spec.t, spec.n)) {
      const stripped = stripVagueShell(s);
      const opener = namedOpener(spec);
      if (stripped && stripped.length > 10) {
        const joiner = stripped.endsWith(',') || stripped.endsWith('—') ? ' ' : ', ';
        const tail = stripped.charAt(0).toLowerCase() + stripped.slice(1);
        out.push(`${opener}${joiner}${tail}`);
      } else if (/same pitch/i.test(s)) {
        out.push(
          `${opener}—intent and feeling share one pitch in this connection.`
        );
      } else {
        out.push(`${opener}.`);
      }
      namedUsed = true;
      continue;
    }

    if (hasVagueShell(s)) {
      const stripped = stripVagueShell(s);
      if (stripped && stripped.length > 8) out.push(stripped.endsWith('.') ? stripped : `${stripped}`);
      continue;
    }

    if (!namedUsed && i === 0 && openerAlreadyNamesBodies(s, spec.t, spec.n)) {
      out.push(s);
      namedUsed = true;
      continue;
    }

    out.push(s);
  }

  if (!namedUsed) {
    out.unshift(`${namedOpener(spec)}.`);
  }

  return joinParts(out);
}

function extractFeedsFromSource(src: string): Map<string, string> {
  const map = new Map<string, string>();
  const keyRe = /^\s+([A-Z][A-Z0-9_]+):\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(src)) !== null) {
    const key = m[1]!;
    const slice = src.slice(m.index, m.index + 15000);
    const feedM = slice.match(/feed:\s*`([^`]+)`/);
    if (feedM) map.set(key, feedM[1]!);
  }
  return map;
}

function main() {
  const oldPath = 'vnext/projection/insight-library/insight-library-aspects-personal.ts';
  const oldSrc = execSync(`git show ${OLD_COMMIT}:${oldPath}`, { cwd: ROOT, encoding: 'utf8' });
  const originals = extractFeedsFromSource(oldSrc);
  let txt = fs.readFileSync(TARGET, 'utf8');

  // Restore original feed strings from rollback commit before surgical pass
  for (const [key, original] of originals) {
    const escapedOrig = original.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
    const re = new RegExp(
      `(\\s+${key}:\\s*\\{[\\s\\S]*?feed:\\s*)\`[\\s\\S]*?\`(\\s*,\\s*\\n\\s*sonic:)`,
      'm'
    );
    txt = txt.replace(re, `$1\`${escapedOrig}\`$2`);
  }

  const lines: string[] = [
    '# personal.ts — surgical feed edits (50 entries)',
    '',
    `Source rollback: \`${OLD_COMMIT}\` feeds. Vague shells stripped; interpretive prose preserved.`,
    '',
    'Run audit: `npx tsx vnext/scripts/audit-vague-feed-fields.ts`',
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
  console.log(`Updated ${n}/${originals.size} feeds in personal.ts`);
  console.log(`Review: ${REVIEW}`);
}

main();
