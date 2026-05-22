/**
 * Audit feed fields for unnamed / vague transit language.
 * Run: npx tsx vnext/scripts/audit-vague-feed-fields.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';

const LIB_DIR = path.join(__dirname, '../projection/insight-library');
const BODY_NAMES = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'chiron',
  'ceres',
  'pallas',
  'juno',
  'vesta',
] as const;

const VAGUE_PATTERNS: Array<{ id: string; re: RegExp }> = [
  { id: 'A transit', re: /\ba transit\b/i },
  { id: "Today's transits", re: /\btoday'?s transits?\b/i },
  { id: 'The current sky', re: /\bthe current sky\b/i },
  { id: 'Transiting frequencies', re: /\btransiting frequencies\b/i },
  { id: 'doubled frequencies', re: /\bdoubled \w+ frequencies\b/i },
  { id: 'current sky (no the)', re: /\bcurrent sky\b/i },
  { id: "Today's transit (singular)", re: /\btoday'?s transit\b/i },
  { id: 'in the sky (generic)', re: /\bin the (?:current )?sky\b/i },
  { id: 'the transit field', re: /\bthe transit field\b/i },
  { id: 'A current transit', re: /\ba current transit\b/i },
  { id: 'The transit is', re: /\bthe transit is\b/i },
];

function bodiesFromKey(key: string): { transit: string; natal: string } | null {
  const ins = getAspectInsight(key);
  if (!ins?.pair) return null;
  const parts = ins.pair.split('_');
  if (parts.length !== 2) return null;
  return { transit: parts[0].toLowerCase(), natal: parts[1].toLowerCase() };
}

function bodyMentioned(text: string, body: string): boolean {
  const re = new RegExp(`\\b${body}\\b`, 'i');
  return re.test(text);
}

function hasTransitingNatalPattern(text: string): boolean {
  return /\btransiting\s+\w+/i.test(text) && /\bnatal\s+\w+/i.test(text);
}

function isExplicit(feed: string, transit: string, natal: string): boolean {
  if (hasTransitingNatalPattern(feed)) return true;
  return bodyMentioned(feed, transit) && bodyMentioned(feed, natal);
}

function matchVaguePatterns(feed: string): string[] {
  const hits: string[] = [];
  for (const p of VAGUE_PATTERNS) {
    if (p.re.test(feed)) hits.push(p.id);
  }
  return hits;
}

type Entry = {
  key: string;
  file: string;
  feed: string;
  first_sentence: string;
  first_sentence_ok: boolean;
  issue: string;
  vague_patterns: string[];
  transit: string;
  natal: string;
};

const aspectFiles = fs
  .readdirSync(LIB_DIR)
  .filter((f) => f.startsWith('insight-library-aspects') && f.endsWith('.ts'))
  .sort();

const sourceKeys: string[] = [];
for (const f of aspectFiles) {
  const txt = fs.readFileSync(path.join(LIB_DIR, f), 'utf8');
  for (const m of txt.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*\{/gm)) {
    sourceKeys.push(m[1]!);
  }
}

const vagueEntries: Entry[] = [];
const byFile = new Map<string, number>();
const byPattern = new Map<string, number>();

for (const key of sourceKeys) {
  const ins = getAspectInsight(key);
  const feed = ins?.feed?.trim() ?? '';
  if (!feed) continue;

  const bodies = bodiesFromKey(key);
  if (!bodies) continue;

  const file =
    aspectFiles.find((f) => {
      const txt = fs.readFileSync(path.join(LIB_DIR, f), 'utf8');
      return txt.includes(`${key}:`);
    }) ?? 'unknown';

  const patterns = matchVaguePatterns(feed);
  const explicit = isExplicit(feed, bodies.transit, bodies.natal);

  const firstSentence = feed.split(/(?<=[.!?])\s+/)[0]?.trim() ?? feed;
  const firstExplicit = isExplicit(firstSentence, bodies.transit, bodies.natal);
  const firstPatterns = matchVaguePatterns(firstSentence);

  if (!explicit || patterns.length > 0) {
    const missing: string[] = [];
    if (!bodyMentioned(feed, bodies.transit)) missing.push(`missing transit: ${bodies.transit}`);
    if (!bodyMentioned(feed, bodies.natal)) missing.push(`missing natal: ${bodies.natal}`);

    const issue =
      patterns.length > 0
        ? `Vague pattern(s): ${patterns.join(', ')}${missing.length ? `; ${missing.join('; ')}` : ''}`
        : missing.join('; ') || 'Does not name both bodies explicitly';

    vagueEntries.push({
      key,
      file,
      feed: feed.length > 160 ? feed.slice(0, 157) + '...' : feed,
      first_sentence: firstSentence.length > 120 ? firstSentence.slice(0, 117) + '...' : firstSentence,
      first_sentence_ok: firstExplicit && firstPatterns.length === 0,
      issue,
      vague_patterns: patterns,
      transit: bodies.transit,
      natal: bodies.natal,
    });

    byFile.set(file, (byFile.get(file) ?? 0) + 1);
    for (const p of patterns) {
      byPattern.set(p, (byPattern.get(p) ?? 0) + 1);
    }
  }
}

const patternObj: Record<string, number> = {};
for (const [k, v] of [...byPattern.entries()].sort((a, b) => b[1] - a[1])) {
  patternObj[k] = v;
}

const byFileObj: Record<string, number> = {};
for (const [k, v] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
  byFileObj[k] = v;
}

const firstSentenceOkInVagueList = vagueEntries.filter((e) => e.first_sentence_ok).length;
const needs_first_sentence_rewrite = vagueEntries.filter((e) => !e.first_sentence_ok).length;

const out = {
  vague_feed_entries: {
    total_scanned: sourceKeys.length,
    total_with_feed: sourceKeys.filter((k) => getAspectInsight(k)?.feed?.trim()).length,
    total_count: vagueEntries.length,
    explicit_count_full_text: sourceKeys.filter((k) => {
      const feed = getAspectInsight(k)?.feed?.trim();
      const b = bodiesFromKey(k);
      return feed && b && isExplicit(feed, b.transit, b.natal) && matchVaguePatterns(feed).length === 0;
    }).length,
    first_sentence_ok_count: sourceKeys.filter((k) => {
      const feed = getAspectInsight(k)?.feed?.trim();
      const b = bodiesFromKey(k);
      if (!feed || !b) return false;
      const s = feed.split(/(?<=[.!?])\s+/)[0]?.trim() ?? feed;
      return isExplicit(s, b.transit, b.natal) && matchVaguePatterns(s).length === 0;
    }).length,
    needs_first_sentence_rewrite,
    partial_ok_opener_only: firstSentenceOkInVagueList,
    by_pattern: patternObj,
    by_file: byFileObj,
    entries: vagueEntries,
  },
};

const outPath = path.join(__dirname, 'audit-vague-feed-fields-output.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(JSON.stringify(out.vague_feed_entries, (k, v) => (k === 'entries' ? undefined : v), 2));
console.error(`\nFull list (${vagueEntries.length} entries) -> ${outPath}`);
