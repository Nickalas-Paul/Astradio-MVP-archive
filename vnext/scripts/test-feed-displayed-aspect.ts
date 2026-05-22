/**
 * Feed display diversity (pass-2 aspect selection): regression suite.
 * Run: npm run vnext:build && node dist/vnext/vnext/scripts/test-feed-displayed-aspect.js
 */
import assert from 'node:assert/strict';

import type { CrossAspectHitV1, RelationalWeatherStateV1 } from '../relational/weather/types';
import { feedDisplayedAspectKey } from '../api/feed-displayed-aspect-v1';
import { buildFeedCollapsedDisplayV1 } from '../api/feed-collapsed-display';
import {
  applyFeedCollapsedDisplayPass2,
  type CommunityRelationalFeedItemPass1V1,
} from '../api/community-relational-feed';
import {
  aspectTypeFromMicroTag,
  buildFeedExplanationSentence,
  fmtBody,
} from '../projection/insight/map-insight-unit-v1';

function hit(p: Omit<CrossAspectHitV1, never>): CrossAspectHitV1 {
  return { ...p };
}

function mkWeather(top: CrossAspectHitV1[]): RelationalWeatherStateV1 {
  return {
    version: 'relational_weather_v1',
    stateHash: 'test-hash',
    connection: { kind: 'pair', bindingId: 'bind', chartIdsOrdered: ['c1', 'c2'] },
    transit: { ts: '2026-01-01T12:00:00Z', tz: 'UTC', lat: 0, lon: 0, houseSystem: 'P' },
    activation: {
      harmony: 0.2,
      friction: 0.2,
      intensity: 0.6,
      emotional_activation: 0.2,
      communication_emphasis: 0.2,
      volatility: 0.2,
      growth_pressure: 0.2,
    },
    score: { raw: 0.3, significance: 0.3 },
    aspects: {
      topCrossAspects: top,
      feedCandidateAspects: top,
      counts: { supportive: 0, tense: 0, amplifying: 0, polarizing: 0, flowing: 0 },
    },
    themes: { dominantThemes: [] },
  };
}

const sunPlutoOpp = hit({
  transitBody: 'Sun',
  natalBody: 'Pluto',
  memberChartId: 'c2',
  type: 'opposition',
  orbDeg: 1,
  exactness: 0.9,
  dynamics: 'polarizing',
  weight: 10,
});

function pass1Row(
  id: string,
  weather: RelationalWeatherStateV1 | null,
  rank: { ae: number; or: number; tb: string }
): CommunityRelationalFeedItemPass1V1 {
  return {
    feed_item_id: id,
    connection_kind: 'pair',
    binding_id: id,
    chart_ids_ordered: ['c1', 'c2'],
    connection_identity_line: 'You · T',
    transit_weather: weather,
    compatibility_field_hash: `hash_${id}`,
    relational_weather_state_hash: 'rw',
    transit_snapshot_hash: 'ts',
    ranking: {
      weather_activation_intensity: 0.7,
      activation_effective: rank.ae,
      overall_relational_intensity: rank.or,
      tie_break_key: rank.tb,
    },
    artifactStatus: 'not_generated',
  };
}

function testRepeatedAspectDistribution(): void {
  const dom = sunPlutoOpp;
  const alt = (natal: string, w: number) =>
    hit({
      transitBody: 'Mercury',
      natalBody: natal,
      memberChartId: 'c2',
      type: 'trine',
      orbDeg: 2,
      exactness: 0.8,
      dynamics: 'flowing',
      weight: w,
    });
  const pass1: CommunityRelationalFeedItemPass1V1[] = [];
  const natals = ['Venus', 'Mars', 'Jupiter', 'Saturn', 'Moon'];
  for (let i = 0; i < 5; i++) {
    const h = mkWeather([
      dom,
      alt(natals[i]!, 5 - i * 0.1),
      hit({
        transitBody: 'Moon',
        natalBody: 'Neptune',
        memberChartId: 'c2',
        type: 'sextile',
        orbDeg: 2,
        exactness: 0.7,
        dynamics: 'supportive',
        weight: 1,
      }),
    ]);
    pass1.push(pass1Row(`pair:rel_${i}`, h, { ae: 0.9 - i * 0.01, or: 0.5 - i * 0.01, tb: `z${i}` }));
  }
  const out = applyFeedCollapsedDisplayPass2(pass1);
  let sameAsIfAlwaysTop = 0;
  for (let i = 0; i < pass1.length; i++) {
    const wx = pass1[i]!.transit_weather;
    assert(wx);
    const baselineMicro = buildFeedCollapsedDisplayV1(wx, dom).micro_tag;
    if (out[i]!.collapsed_display.micro_tag === baselineMicro) sameAsIfAlwaysTop += 1;
  }
  assert.ok(
    sameAsIfAlwaysTop < pass1.length,
    `expected at least one row to change off dominant-display; matched always-top ${sameAsIfAlwaysTop}/${pass1.length}`
  );
}

function testFallbackTruth(): void {
  const only = mkWeather([
    hit({
      transitBody: 'Sun',
      natalBody: 'Moon',
      memberChartId: 'c2',
      type: 'conjunction',
      orbDeg: 0.5,
      exactness: 0.95,
      dynamics: 'amplifying',
      weight: 11,
    }),
  ]);
  const pass1 = [
    pass1Row('a', only, { ae: 0.9, or: 0.5, tb: 'a' }),
    pass1Row('b', only, { ae: 0.89, or: 0.49, tb: 'b' }),
    pass1Row('c', only, { ae: 0.88, or: 0.48, tb: 'c' }),
  ];
  const hero = only.aspects.topCrossAspects[0]!;
  const baseline = buildFeedCollapsedDisplayV1(only, hero);
  const out = applyFeedCollapsedDisplayPass2(pass1);
  for (const row of out) {
    assert.equal(row.collapsed_display.primary_line, baseline.primary_line);
    assert.equal(row.collapsed_display.micro_tag, baseline.micro_tag);
  }
}

function testExplanationAlignment(): void {
  const w = mkWeather([
    sunPlutoOpp,
    hit({
      transitBody: 'Venus',
      natalBody: 'Mars',
      memberChartId: 'c2',
      type: 'square',
      orbDeg: 1,
      exactness: 0.85,
      dynamics: 'tense',
      weight: 4,
    }),
  ]);
  const pass1 = [pass1Row('pair:x', w, { ae: 0.8, or: 0.5, tb: 't1' })];
  const out = applyFeedCollapsedDisplayPass2(pass1);
  const cd = out[0]!.collapsed_display;
  const surf = buildFeedExplanationSentence({
    ranking: {
      weather_activation_intensity: out[0]!.ranking.weather_activation_intensity,
      activation_effective: out[0]!.ranking.activation_effective,
      overall_relational_intensity: out[0]!.ranking.overall_relational_intensity,
    },
    micro_tag: cd.micro_tag,
    primary_line: cd.primary_line,
    shell_rotate: 0,
  });
  const at = aspectTypeFromMicroTag(cd.micro_tag);
  assert.equal(at, sunPlutoOpp.type);
  assert.ok(surf.length > 20, 'surfacing sentence present');
  assert.ok(cd.micro_tag.includes(fmtBody(sunPlutoOpp.transitBody)));
  assert.ok(cd.micro_tag.includes(fmtBody(sunPlutoOpp.natalBody)));
}

function testRankingUnchanged(): void {
  const w = mkWeather([sunPlutoOpp, { ...sunPlutoOpp, natalBody: 'Mars', type: 'trine' as const, weight: 3 }]);
  const pass1 = [
    pass1Row('pair:a', w, { ae: 0.95, or: 0.6, tb: 'x' }),
    pass1Row('pair:b', w, { ae: 0.6, or: 0.4, tb: 'y' }),
  ];
  const expectedOrder = [...pass1.map((r) => r.feed_item_id)];
  const out = applyFeedCollapsedDisplayPass2(pass1);
  const gotOrder = out.map((r) => r.feed_item_id);
  assert.deepEqual(gotOrder, expectedOrder);
  for (let i = 0; i < pass1.length; i++) {
    assert.deepEqual(out[i]!.ranking, pass1[i]!.ranking);
    assert.equal(out[i]!.compatibility_field_hash, pass1[i]!.compatibility_field_hash);
  }
}

function testDeterminism(): void {
  const bodies = ['Venus', 'Mars', 'Jupiter'];
  const pass1: CommunityRelationalFeedItemPass1V1[] = [];
  for (let i = 0; i < 3; i++) {
    const b = bodies[i % bodies.length]!;
    const wx = mkWeather([
      sunPlutoOpp,
      hit({
        transitBody: 'Mercury',
        natalBody: b,
        memberChartId: 'c2',
        type: 'sextile',
        orbDeg: 1,
        exactness: 0.75,
        dynamics: 'supportive',
        weight: 8,
      }),
    ]);
    pass1.push(pass1Row(`id_${i}`, wx, { ae: 1 - i * 0.01, or: 0.5, tb: `${i}` }));
  }
  const a = applyFeedCollapsedDisplayPass2(pass1);
  const b = applyFeedCollapsedDisplayPass2(pass1);
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
}

/**
 * Rows after index 9 still run the same W-window selector (no row-cap shortcut).
 * With only two distinct keys, both can sit in the last W slots — fallback [0] is expected often.
 * Use three hits so the tail can still surface non-dominant aspects past index 9.
 */
function testTailParticipatesInDiversity(): void {
  const moonSat = hit({
    transitBody: 'Moon',
    natalBody: 'Saturn',
    memberChartId: 'c2',
    type: 'square',
    orbDeg: 1,
    exactness: 0.8,
    dynamics: 'tense',
    weight: 9,
  });
  const mercVen = hit({
    transitBody: 'Mercury',
    natalBody: 'Venus',
    memberChartId: 'c2',
    type: 'trine',
    orbDeg: 2,
    exactness: 0.75,
    dynamics: 'flowing',
    weight: 5,
  });
  const three = mkWeather([sunPlutoOpp, moonSat, mercVen]);
  const pass1: CommunityRelationalFeedItemPass1V1[] = [];
  for (let i = 0; i < 12; i++) {
    pass1.push(pass1Row(`pair:r${i}`, three, { ae: 0.9 - i * 0.001, or: 0.5, tb: `${i}_k` }));
  }
  const out = applyFeedCollapsedDisplayPass2(pass1);
  const domMicro = buildFeedCollapsedDisplayV1(three, sunPlutoOpp).micro_tag;
  const tail = out.slice(10);
  assert.ok(
    tail.some((r) => r.collapsed_display.micro_tag !== domMicro),
    'tail rows (index >= 10) should still participate in diversity when ≥3 aspect keys exist'
  );
}

/** 17 items like live QA: shared dominant [0], distinct alternates — diversity applies through last row. */
function testFullFeedSeventeenItemsDiversity(): void {
  const dom = sunPlutoOpp;
  const pass1: CommunityRelationalFeedItemPass1V1[] = [];
  const altNatals = ['Venus', 'Mars', 'Jupiter', 'Saturn', 'Moon', 'Mercury', 'Sun', 'Neptune', 'Uranus'];
  for (let i = 0; i < 17; i++) {
    const alt = hit({
      transitBody: 'Mercury',
      natalBody: altNatals[i % altNatals.length]!,
      memberChartId: 'c2',
      type: 'trine',
      orbDeg: 2,
      exactness: 0.75,
      dynamics: 'flowing',
      weight: 6,
    });
    pass1.push(
      pass1Row(`pair:x${i}`, mkWeather([dom, alt]), {
        ae: 0.92 - i * 0.001,
        or: 0.5 - i * 0.001,
        tb: `z${String(i).padStart(3, '0')}`,
      })
    );
  }
  const out = applyFeedCollapsedDisplayPass2(pass1);
  const domMicro = buildFeedCollapsedDisplayV1(pass1[0]!.transit_weather!, dom).micro_tag;
  const keys = out.map((row, idx) => {
    const w = pass1[idx]!.transit_weather!;
    const list = w.aspects.topCrossAspects;
    const chosen = list.find(
      (h) =>
        buildFeedCollapsedDisplayV1(w, h).micro_tag === row.collapsed_display.micro_tag
    );
    assert.ok(chosen, `row ${idx} collapsed_display must match a hit in topCrossAspects`);
    return feedDisplayedAspectKey(chosen!);
  });
  const uniqueKeys = new Set(keys);
  assert.ok(uniqueKeys.size >= 8, `expected diversified keys across 17 rows, got ${uniqueKeys.size} unique`);
  const tailKeys = keys.slice(10);
  const tailOnlyDom = tailKeys.every((k) => k === feedDisplayedAspectKey(dom));
  assert.ok(!tailOnlyDom, 'tail rows (index >= 10) must not all show dominant key when alternates exist');
  let repeats = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i]!.collapsed_display.micro_tag === domMicro) repeats += 1;
  }
  assert.ok(repeats < 17, 'not every row should display dominant micro_tag when each row has a distinct alternate');
}

function main(): void {
  testRepeatedAspectDistribution();
  testFallbackTruth();
  testExplanationAlignment();
  testRankingUnchanged();
  testDeterminism();
  testTailParticipatesInDiversity();
  testFullFeedSeventeenItemsDiversity();
  console.log('[test-feed-displayed-aspect] PASS');
}

main();
