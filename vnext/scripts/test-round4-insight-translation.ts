/**
 * Round 4 guard tests (determinism, uniqueness, feed bounds).
 * Run: `npm run vnext:build && node dist/vnext/scripts/test-round4-insight-translation.js`
 */
import bodyPairDoc from '../projection/literals/body-pair-meaning-v1.json';
import explanationShells from '../projection/literals/feed-explanation-shells-v1.json';
import type { CrossAspectHitV1 } from '../relational/weather/types';
import {
  buildCollapsedPrimaryLineFromHit,
  buildFeedExplanationSentence,
  mapInsightUnitFromFeed,
  prepareTemplatePrepend,
} from '../projection/insight/map-insight-unit-v1';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error('[round4-insight-test] FAIL: ' + msg);
}

function wordCount(line: string): number {
  return line.split(/\s+/).filter(Boolean).length;
}

function hit(p: Partial<CrossAspectHitV1>): CrossAspectHitV1 {
  return {
    transitBody: p.transitBody ?? 'sun',
    natalBody: p.natalBody ?? 'moon',
    memberChartId: p.memberChartId ?? 'm1',
    type: (p.type ?? 'opposition') as CrossAspectHitV1['type'],
    orbDeg: p.orbDeg ?? 1,
    exactness: p.exactness ?? 0.9,
    dynamics: (p.dynamics ?? 'polarizing') as CrossAspectHitV1['dynamics'],
    weight: p.weight ?? 1,
  };
}

export function main(): void {
  const rows = [...(bodyPairDoc as { pairs: { body_pair_key: string; meaning_clause: string }[] }).pairs];
  const coreRows = rows.filter((r) => r.body_pair_key !== '*|*');
  assert(coreRows.length === 45, 'expected 45 core body rows');
  const meanings = new Set(coreRows.map((r) => r.meaning_clause));
  assert(meanings.size === coreRows.length, 'meaning_clause must be unique per pair');

  const five = coreRows.slice(0, 5).map((r) => r.meaning_clause);
  assert(new Set(five).size === 5, 'first five meanings must remain distinct');

  const h1 = hit({ transitBody: 'sun', natalBody: 'pluto', type: 'opposition', dynamics: 'polarizing' });
  const h2 = hit({ transitBody: 'moon', natalBody: 'neptune', type: 'opposition', dynamics: 'polarizing' });
  const h3 = hit({ transitBody: 'mercury', natalBody: 'saturn', type: 'opposition', dynamics: 'polarizing' });
  const l1 = buildCollapsedPrimaryLineFromHit(h1);
  const l2 = buildCollapsedPrimaryLineFromHit(h2);
  const l3 = buildCollapsedPrimaryLineFromHit(h3);
  assert(l1 !== l2 && l2 !== l3 && l1 !== l3, 'opposition polarizing lines must differ by pair');
  for (const L of [l1, l2, l3]) {
    const wc = wordCount(L);
    assert(wc >= 12 && wc <= 22, 'primary line bound 12–22 words, got ' + wc + ': ' + L);
  }

  const twice = buildCollapsedPrimaryLineFromHit(h1);
  assert(twice === l1, 'determinism: same hit must reproduce identical primary line');

  const u1 = mapInsightUnitFromFeed(h1);
  const u2 = mapInsightUnitFromFeed(h1);
  assert(JSON.stringify(u1) === JSON.stringify(u2), 'insight unit snapshot stable');

  const expl = buildFeedExplanationSentence({
    ranking: { weather_activation_intensity: 0.7, activation_effective: 0.4, overall_relational_intensity: 0.45 },
    micro_tag: 'Sun ☍ Pluto',
    primary_line: l1,
    shell_rotate: 0,
  });
  assert(expl.includes('.'), 'surfacing explanation must include terminal punctuation');

  let defaultHits = 0;
  const defaultA = explanationShells.default_activation_clause as string;
  const defaultB = explanationShells.default_baseline_clause as string;
  const N = 36;
  for (let i = 0; i < N; i++) {
    const line = buildCollapsedPrimaryLineFromHit(
      hit({ transitBody: 'sun', natalBody: 'pluto', dynamics: 'polarizing' })
    );
    const ex = buildFeedExplanationSentence({
      ranking: {
        weather_activation_intensity: 0.1 + (i % 9) * 0.03,
        activation_effective: 0.1 + ((i + 3) % 9) * 0.03,
        overall_relational_intensity: 0.1 + ((i + 5) % 9) * 0.03,
      },
      micro_tag: 'Sun ☍ Pluto',
      primary_line: line,
      shell_rotate: i % 3,
    });
    if (ex.includes(defaultA) && ex.includes(defaultB)) defaultHits++;
  }
  assert(defaultHits / N <= 0.45, `default surfacing saturation ${defaultHits / N}`);

  const prep = prepareTemplatePrepend(
    'SECTION_SIGNATURES',
    u1.meaning,
    u1.behavior,
    'Primary coloring centers mood cues for today without stretching meaning.'
  );
  assert(prep === null || prep === u1.meaning.trim(), 'prepend must be verbatim meaning or suppressed');

  // eslint-disable-next-line no-console
  console.log('[round4-insight-test] PASS');
}

if (require.main === module) {
  main();
}
