/**
 * One-off audit: Feed library content coverage (transit×natal grid + field inventory).
 * Run: npm run vnext:build && npx tsx vnext/scripts/audit-feed-library-coverage.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { CORE_BODIES } from '../canonical-bodies';

const ASPECTS = ['conjunction', 'opposition', 'square', 'trine', 'sextile'] as const;
const INNER = new Set(['moon', 'mercury', 'venus', 'mars']);
const MEDIUM = new Set(['jupiter', 'saturn']);
const OUTER = new Set(['uranus', 'neptune', 'pluto']);
const LUMINARIES = new Set(['sun', 'moon']);

type FeedClass = 'transit_relational' | 'transit_personal' | 'natal_only' | 'mixed' | 'empty';

function classifyFeed(text: string): FeedClass {
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
  if (temporal && !relational) return 'transit_personal';
  if (natalOnly && !temporal) return 'natal_only';
  if (temporal) return 'mixed';
  return 'natal_only';
}

function classifyTransitField(text: string): 'transit_personal' | 'natal_mislabeled' | 'empty' {
  const t = String(text || '').trim();
  if (!t) return 'empty';
  const temporal =
    /\b(today|right now|this window|lasts \d|during this|transiting|your .+ forms a)\b/i.test(t);
  const secondPerson = /\b(your |you're |you are )\b/i.test(t);
  if (temporal && secondPerson) return 'transit_personal';
  return 'natal_mislabeled';
}

function tierForTransitBody(tb: string): 1 | 2 | 3 | 4 {
  const b = tb.toLowerCase();
  if (INNER.has(b)) return 1;
  if (MEDIUM.has(b)) return 2;
  if (OUTER.has(b)) return 3;
  if (b === 'sun') return 2;
  return 3;
}

function tierForCombo(tBody: string, nBody: string): 1 | 2 | 3 | 4 {
  const t = tierForTransitBody(tBody);
  const n = nBody.toLowerCase();
  const outerNatal = OUTER.has(n);
  const outerTransit = OUTER.has(tBody.toLowerCase());
  if (t === 1) return 1;
  if (t === 2) return 2;
  if (outerTransit && outerNatal) return 4;
  if (t === 3) return 3;
  return 3;
}

// Collect all aspect-file keys from source
const libDir = path.join(__dirname, '../projection/insight-library');
const aspectFiles = fs
  .readdirSync(libDir)
  .filter((f) => f.startsWith('insight-library-aspects') && f.endsWith('.ts'));

const sourceKeys: string[] = [];
for (const f of aspectFiles) {
  const txt = fs.readFileSync(path.join(libDir, f), 'utf8');
  for (const m of txt.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*\{/gm)) {
    sourceKeys.push(m[1]!);
  }
}

const entryStats: Array<{
  key: string;
  hasFeed: boolean;
  feedClass: FeedClass;
  hasCoreTransit: boolean;
  hasBehavioralTransit: boolean;
  coreTransitClass: ReturnType<typeof classifyTransitField>;
  behavioralTransitClass: ReturnType<typeof classifyTransitField>;
}> = [];

for (const key of sourceKeys) {
  const ins = getAspectInsight(key);
  if (!ins) {
    entryStats.push({
      key,
      hasFeed: false,
      feedClass: 'empty',
      hasCoreTransit: false,
      hasBehavioralTransit: false,
      coreTransitClass: 'empty',
      behavioralTransitClass: 'empty',
    });
    continue;
  }
  entryStats.push({
    key,
    hasFeed: !!ins.feed?.trim(),
    feedClass: classifyFeed(ins.feed || ''),
    hasCoreTransit: !!ins.core_transit?.trim(),
    hasBehavioralTransit: !!ins.behavioral_transit?.trim(),
    coreTransitClass: classifyTransitField(ins.core_transit || ''),
    behavioralTransitClass: classifyTransitField(ins.behavioral_transit || ''),
  });
}

// 450 grid (exclude same body)
type GridRow = {
  transitBody: string;
  natalBody: string;
  aspect: string;
  key: string;
  tier: 1 | 2 | 3 | 4;
  hasEntry: boolean;
  hasFeed: boolean;
  hasCoreTransit: boolean;
  hasBehavioralTransit: boolean;
  feedClass: FeedClass | 'no_entry';
};

const grid: GridRow[] = [];
for (const tb of CORE_BODIES) {
  for (const nb of CORE_BODIES) {
    if (tb.toLowerCase() === nb.toLowerCase()) continue;
    for (const aspect of ASPECTS) {
      const key = buildAspectKey(tb, nb, aspect);
      const ins = getAspectInsight(key);
      grid.push({
        transitBody: tb,
        natalBody: nb,
        aspect,
        key,
        tier: tierForCombo(tb, nb),
        hasEntry: !!ins,
        hasFeed: !!ins?.feed?.trim(),
        hasCoreTransit: !!ins?.core_transit?.trim(),
        hasBehavioralTransit: !!ins?.behavioral_transit?.trim(),
        feedClass: ins ? classifyFeed(ins.feed || '') : 'no_entry',
      });
    }
  }
}

function countBy<T>(arr: T[], fn: (x: T) => string): Record<string, number> {
  const o: Record<string, number> = {};
  for (const x of arr) {
    const k = fn(x);
    o[k] = (o[k] || 0) + 1;
  }
  return o;
}

const feedClassCounts = countBy(entryStats, (e) => e.feedClass);
const coreTransitCount = entryStats.filter((e) => e.hasCoreTransit).length;
const behavioralTransitCount = entryStats.filter((e) => e.hasBehavioralTransit).length;
const bothTransit = entryStats.filter((e) => e.hasCoreTransit && e.hasBehavioralTransit).length;

const gridHasEntry = grid.filter((g) => g.hasEntry).length;
const gridMissing = grid.filter((g) => !g.hasEntry);

const tierGaps = (tier: 1 | 2 | 3 | 4) => grid.filter((g) => g.tier === tier && !g.hasEntry);
const tierMissingFeedTransit = (tier: 1 | 2 | 3 | 4) =>
  grid.filter(
    (g) =>
      g.tier === tier &&
      g.hasEntry &&
      (!g.hasCoreTransit || !g.hasBehavioralTransit || g.feedClass === 'natal_only')
  );

// Pair gap aggregation
const pairGapMap = new Map<string, string[]>();
for (const g of gridMissing) {
  const pair = g.key.split('_').slice(0, 2).join('_');
  if (!pairGapMap.has(pair)) pairGapMap.set(pair, []);
  pairGapMap.get(pair)!.push(g.aspect);
}

const report = {
  sourceEntryCount: sourceKeys.length,
  indexedEntryCount: sourceKeys.filter((k) => getAspectInsight(k)).length,
  gridTotal: grid.length,
  gridHasEntry,
  gridMissingCount: gridMissing.length,
  gridCoveragePct: Math.round((gridHasEntry / grid.length) * 1000) / 10,
  fieldAudit: {
    feed: {
      populated: entryStats.filter((e) => e.hasFeed).length,
      byClass: feedClassCounts,
    },
    core_transit: {
      populated: coreTransitCount,
      transitPersonal: entryStats.filter((e) => e.coreTransitClass === 'transit_personal').length,
    },
    behavioral_transit: {
      populated: behavioralTransitCount,
      transitPersonal: entryStats.filter((e) => e.behavioralTransitClass === 'transit_personal').length,
    },
    both_transit_fields: bothTransit,
  },
  tierMissingEntries: {
    tier1: tierGaps(1).length,
    tier2: tierGaps(2).length,
    tier3: tierGaps(3).length,
    tier4: tierGaps(4).length,
  },
  tierNeedsContentOnExisting: {
    tier1: tierMissingFeedTransit(1).length,
    tier2: tierMissingFeedTransit(2).length,
    tier3: tierMissingFeedTransit(3).length,
    tier4: tierMissingFeedTransit(4).length,
  },
  topPairGaps: [...pairGapMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15)
    .map(([pair, aspects]) => ({ pair, missingAspects: aspects.length, aspects })),
  sampleEntries: {
    feed_transit_relational: entryStats
      .filter((e) => e.feedClass === 'transit_relational')
      .slice(0, 3)
      .map((e) => ({ key: e.key, feed: getAspectInsight(e.key)?.feed?.slice(0, 200) })),
    feed_natal_only: entryStats
      .filter((e) => e.feedClass === 'natal_only')
      .slice(0, 3)
      .map((e) => ({ key: e.key, feed: getAspectInsight(e.key)?.feed?.slice(0, 200) })),
    core_transit_samples: entryStats
      .filter((e) => e.hasCoreTransit)
      .slice(0, 3)
      .map((e) => ({
        key: e.key,
        core_transit: getAspectInsight(e.key)?.core_transit?.slice(0, 200),
      })),
    no_core_transit_tier1: grid
      .filter((g) => g.tier === 1 && g.hasEntry && !g.hasCoreTransit)
      .slice(0, 5)
      .map((g) => g.key),
  },
};

const outPath = path.join(__dirname, 'audit-feed-library-coverage-output.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.error('\nWrote', outPath);
