/**
 * Tier needs-content breakdown. Run: npx tsx vnext/scripts/audit-tier-breakdown.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { CORE_BODIES } from '../canonical-bodies';

const ASPECTS = ['conjunction', 'opposition', 'square', 'trine', 'sextile'] as const;
const INNER = new Set(['moon', 'mercury', 'venus', 'mars']);
const OUTER = new Set(['uranus', 'neptune', 'pluto']);

function classifyFeed(text: string): string {
  const t = String(text || '').trim();
  if (!t) return 'empty';
  const lower = t.toLowerCase();
  const temporal =
    /\b(today|right now|in this moment|current sky|today's transit|transit field|this window)\b/i.test(t);
  const relational = /\b(between these (two )?charts|this connection|between these two people)\b/i.test(lower);
  const natalOnly =
    /\b(in your natal chart|natal chart|your sun and|are trine in your|are square in your)\b/i.test(lower) &&
    !temporal;
  if (temporal && relational) return 'transit_relational';
  if (natalOnly && !temporal) return 'natal_only';
  return 'other';
}

function tierForCombo(tb: string, nb: string): 1 | 2 | 3 | 4 {
  const t = tb.toLowerCase();
  if (INNER.has(t)) return 1;
  if (t === 'sun' || t === 'jupiter' || t === 'saturn') return 2;
  if (OUTER.has(t) && OUTER.has(nb.toLowerCase())) return 4;
  if (OUTER.has(t)) return 3;
  return 3;
}

type Row = { key: string; tier: 1 | 2 | 3 | 4; transitBody: string; natalBody: string; aspect: string; issues: string[] };
const needs: Row[] = [];
const seen = new Set<string>();

for (const tb of CORE_BODIES) {
  for (const nb of CORE_BODIES) {
    if (tb.toLowerCase() === nb.toLowerCase()) continue;
    for (const aspect of ASPECTS) {
      const key = buildAspectKey(tb, nb, aspect);
      const ins = getAspectInsight(key);
      if (!ins) continue;
      const tier = tierForCombo(tb, nb);
      const issues: string[] = [];
      if (classifyFeed(ins.feed || '') === 'natal_only') issues.push('natal_only_feed');
      if (!ins.core_transit?.trim()) issues.push('missing_core_transit');
      if (!ins.behavioral_transit?.trim()) issues.push('missing_behavioral_transit');
      if (!issues.length) continue;
      const dedupe = `${tier}|${key}|${issues.sort().join(',')}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      needs.push({ key, tier, transitBody: tb, natalBody: nb, aspect, issues });
    }
  }
}

const libDir = path.join(__dirname, '../projection/insight-library');
const sourceKeys: string[] = [];
for (const f of fs.readdirSync(libDir).filter((x) => x.startsWith('insight-library-aspects') && x.endsWith('.ts'))) {
  const txt = fs.readFileSync(path.join(libDir, f), 'utf8');
  for (const m of txt.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*\{/gm)) sourceKeys.push(m[1]!);
}

let missingCore = 0;
let missingBeh = 0;
let missingEither = 0;
let natalFeed = 0;
const natalFeedKeys: string[] = [];
for (const key of sourceKeys) {
  const ins = getAspectInsight(key);
  if (!ins) continue;
  if (!ins.core_transit?.trim()) missingCore++;
  if (!ins.behavioral_transit?.trim()) missingBeh++;
  if (!ins.core_transit?.trim() || !ins.behavioral_transit?.trim()) missingEither++;
  if (classifyFeed(ins.feed || '') === 'natal_only') {
    natalFeed++;
    natalFeedKeys.push(key);
  }
}

function summarize(tier: 1 | 2 | 3 | 4) {
  const rows = needs.filter((r) => r.tier === tier);
  const uniqueKeys = [...new Set(rows.map((r) => r.key))].sort();
  const issueCounts: Record<string, number> = {};
  for (const r of rows) for (const i of r.issues) issueCounts[i] = (issueCounts[i] || 0) + 1;
  const pairCounts: Record<string, number> = {};
  for (const k of uniqueKeys) {
    const pair = k.split('_').slice(0, 2).join('_');
    pairCounts[pair] = (pairCounts[pair] || 0) + 1;
  }
  return { gridCellsFlagged: rows.length, uniqueKeys: uniqueKeys.length, keys: uniqueKeys, issueCounts, pairCounts };
}

console.log(
  JSON.stringify(
    {
      entryLevel: {
        totalAspectInsightEntries: sourceKeys.length,
        natal_only_feed: natalFeed,
        natal_only_feed_keys: natalFeedKeys.sort(),
        missing_core_transit: missingCore,
        missing_behavioral_transit: missingBeh,
        missing_either_transit_field: missingEither,
        has_both_transit_fields: sourceKeys.length - missingEither,
      },
      tierNeedsContent: {
        tier1: summarize(1),
        tier2: summarize(2),
        tier3: summarize(3),
        tier4: summarize(4),
      },
    },
    null,
    2,
  ),
);
