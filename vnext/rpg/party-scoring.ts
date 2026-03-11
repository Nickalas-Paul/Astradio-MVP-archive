import type { PartyProfile, PartyRoutingScore } from './party-types';

export interface BuildPartyRoutingScoreParams {
  party: PartyProfile;
  /** Deterministic list of domains to consider for routing. */
  domains: string[];
}

export function buildPartyRoutingScore(params: BuildPartyRoutingScoreParams): PartyRoutingScore {
  const { party, domains } = params;

  const domainWeights: Record<string, number> = {};
  for (const domain of domains) {
    let weight = 0;
    if (domain.includes('community')) {
      weight += party.elementBlend.water * 0.4;
      weight += party.modalityBlend.cardinal * 0.3;
      weight += party.supportIndex * 0.3;
    } else if (domain.includes('identity')) {
      weight += party.elementBlend.fire * 0.5;
      weight += party.tensionIndex * 0.3;
      weight += party.modalityBlend.fixed * 0.2;
    } else if (domain.includes('work') || domain.includes('career')) {
      weight += party.elementBlend.earth * 0.4;
      weight += party.modalityBlend.cardinal * 0.3;
      weight += party.supportIndex * 0.3;
    } else {
      weight += (party.tensionIndex + party.supportIndex) * 0.25;
    }
    domainWeights[domain] = weight;
  }

  const roleCoverageScore =
    Object.keys(party.roleDistribution).length > 0
      ? Math.min(1, Object.keys(party.roleDistribution).length / 4)
      : 0;

  const elementalBalanceScore =
    1 -
    (Math.abs(party.elementBlend.fire - party.elementBlend.air) +
      Math.abs(party.elementBlend.earth - party.elementBlend.water)) /
      4;

  const modalityBalanceScore =
    1 -
    (Math.abs(party.modalityBlend.cardinal - party.modalityBlend.fixed) +
      Math.abs(party.modalityBlend.fixed - party.modalityBlend.mutable)) /
      4;

  const supportComplementScore = party.supportIndex;

  const frictionScore = party.tensionIndex;

  const redundancyPenalty = party.roleRedundancyIndex;

  const shadowRiskPenalty = party.tensionIndex * 0.5;

  let routingScalar = 0;
  for (const [dom, w] of Object.entries(domainWeights)) {
    routingScalar += (dom.length % 7) * w;
  }

  let total = 0;
  for (const w of Object.values(domainWeights)) {
    total += w;
  }
  total +=
    roleCoverageScore * 0.3 +
    elementalBalanceScore * 0.2 +
    modalityBalanceScore * 0.1 +
    supportComplementScore * 0.2 +
    frictionScore * 0.1 -
    redundancyPenalty * 0.15 -
    shadowRiskPenalty * 0.15;

  return {
    partyId: party.id,
    roleCoverageScore,
    elementalBalanceScore,
    modalityBalanceScore,
    supportComplementScore,
    frictionScore,
    redundancyPenalty,
    shadowRiskPenalty,
    domainWeights,
    routingScalar,
    total,
  };
}

