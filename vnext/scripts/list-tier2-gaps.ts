/**
 * List tier-2 grid keys needing feed/transit fixes.
 * Run: npx tsx vnext/scripts/list-tier2-gaps.ts
 */
import { getAspectInsight, buildAspectKey } from '../projection/insight-library/insight-library-index';
import { CORE_BODIES } from '../canonical-bodies';

const ASPECTS = ['conjunction', 'opposition', 'square', 'trine', 'sextile'] as const;
const INNER = new Set(['moon', 'mercury', 'venus', 'mars']);
const OUTER = new Set(['uranus', 'neptune', 'pluto']);

function tier(tb: string, nb: string): number {
  const t = tb.toLowerCase();
  if (INNER.has(t)) return 1;
  if (t === 'sun' || t === 'jupiter' || t === 'saturn') return 2;
  if (OUTER.has(t) && OUTER.has(nb.toLowerCase())) return 4;
  if (OUTER.has(t)) return 3;
  return 2;
}

function feedClass(text: string | undefined): string {
  const t = String(text ?? '').trim();
  if (!t) return 'empty';
  const temporal = /\b(today|right now|current sky|between these charts|this connection today)\b/i.test(t);
  const natalOnly = /\b(natal chart|in your natal)\b/i.test(t);
  if (temporal && !natalOnly) return 'transit_relational';
  if (natalOnly) return 'natal_only';
  return 'natal_only';
}

function transitLead(ct: string | undefined): string {
  if (!ct?.trim()) return 'missing';
  if (/^Transiting /i.test(ct)) return 'transiting';
  return 'other';
}

const needs: { key: string; feed: string; transit: string }[] = [];

for (const tb of CORE_BODIES) {
  for (const nb of CORE_BODIES) {
    if (tb.toLowerCase() === nb.toLowerCase()) continue;
    for (const a of ASPECTS) {
      const k = buildAspectKey(tb, nb, a);
      const ins = getAspectInsight(k);
      if (!ins || tier(tb, nb) !== 2) continue;
      const fc = feedClass(ins.feed);
      const hasCT = !!ins.core_transit?.trim();
      const hasBT = !!ins.behavioral_transit?.trim();
      const lead = transitLead(ins.core_transit);
      if (!hasCT || !hasBT || fc === 'natal_only' || lead === 'other') {
        needs.push({
          key: k,
          feed: fc,
          transit: !hasCT || !hasBT ? 'missing_fields' : lead,
        });
      }
    }
  }
}

console.log('tier2 needs', needs.length);
for (const n of needs) console.log(n.key, n.feed, n.transit);
