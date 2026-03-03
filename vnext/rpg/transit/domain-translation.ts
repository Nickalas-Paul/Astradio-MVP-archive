// vnext/rpg/transit/domain-translation.ts
// Layer 2: Map transit signals into abstract domains.

import type { RPGTransitSignal, RPGDomainScore, BodyId } from '../contracts';
import { loadRpgV1Maps } from '../maps/load-v1';

interface DomainAgg {
  score: number;
  contributors: Set<string>;
}

export function translateSignalsToDomains(signals: RPGTransitSignal[]): RPGDomainScore[] {
  const maps = loadRpgV1Maps();
  const houseArena = maps.houseArena;
  const domainResolver = maps.domainResolverTransit;

  const agg = new Map<string, DomainAgg>();

  for (const sig of signals) {
    const arena = sig.house != null ? houseArena[String(sig.house)] ?? 'unknown' : 'unknown';
    const contributorId = sig.signal_id;

    for (const rule of domainResolver) {
      if (!rule || rule.kind !== 'transit') continue;
      const body: BodyId | undefined = rule.body;
      if (body && body !== sig.body) continue;
      const aspect = rule.aspect || null;
      if (aspect && sig.aspect && aspect !== sig.aspect) continue;
      const houseDomain = rule.house_domain || null;
      if (houseDomain && houseDomain !== arena) continue;

      const weightField = rule.weight_field as 'tension' | 'support' | 'weight' | undefined;
      let sourceWeight = sig.weight;
      if (weightField === 'tension') sourceWeight = sig.tensionScore;
      else if (weightField === 'support') sourceWeight = sig.supportScore;

      if (sourceWeight <= 0) continue;

      const factor = typeof rule.multiplier === 'number' ? rule.multiplier : 1;
      const contribution = sourceWeight * factor;

      if (Array.isArray(rule.domains)) {
        for (const d of rule.domains) {
          if (typeof d !== 'string') continue;
          const prev = agg.get(d) ?? { score: 0, contributors: new Set<string>() };
          prev.score += contribution;
          prev.contributors.add(contributorId);
          agg.set(d, prev);
        }
      }
    }
  }

  const scores: RPGDomainScore[] = [];
  let maxScore = 0;
  for (const [domain, { score, contributors }] of agg.entries()) {
    if (score > maxScore) maxScore = score;
    scores.push({
      domain,
      score,
      normalizedScore: 0,
      contributingSignals: Array.from(contributors).sort(),
    });
  }

  if (maxScore > 0) {
    for (const s of scores) {
      s.normalizedScore = s.score / maxScore;
    }
  }

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.domain.localeCompare(b.domain);
  });

  return scores;
}

