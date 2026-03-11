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

  let routingScalar = 0;
  for (const [dom, w] of Object.entries(domainWeights)) {
    routingScalar += (dom.length % 7) * w;
  }

  let total = 0;
  for (const w of Object.values(domainWeights)) {
    total += w;
  }

  return {
    partyId: party.id,
    domainWeights,
    routingScalar,
    total,
  };
}

