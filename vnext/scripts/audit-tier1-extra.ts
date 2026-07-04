import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { CORE_BODIES } from '../canonical-bodies';

const ASPECTS = ['conjunction', 'opposition', 'square', 'trine', 'sextile'] as const;
const INNER = new Set(['moon', 'mercury', 'venus', 'mars']);

function classifyFeed(text: string): string {
  const lower = String(text || '').toLowerCase();
  const temporal = /\b(today|right now|current sky|this window)\b/i.test(text);
  const natalOnly = /\b(in your natal chart|natal chart)\b/i.test(lower) && !temporal;
  if (natalOnly) return 'natal_only';
  return 'ok';
}

for (const tb of CORE_BODIES) {
  if (!INNER.has(tb.toLowerCase())) continue;
  for (const nb of CORE_BODIES) {
    if (tb.toLowerCase() === nb.toLowerCase()) continue;
    for (const aspect of ASPECTS) {
      const key = buildAspectKey(tb, nb, aspect);
      const ins = getAspectInsight(key);
      if (!ins) continue;
      const issues: string[] = [];
      if (classifyFeed(ins.feed || '') === 'natal_only') issues.push('natal_only_feed');
      if (!ins.core_transit?.trim()) issues.push('missing_core_transit');
      if (!ins.behavioral_transit?.trim()) issues.push('missing_behavioral_transit');
      if (issues.length) console.log(key, `transit=${tb}`, `natal=${nb}`, issues.join(','));
    }
  }
}
