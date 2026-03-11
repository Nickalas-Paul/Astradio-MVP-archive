export interface PartyMemberRef {
  userId: string;
  chartId: string;
}

export interface PartyProfile {
  id: string;
  formationMode: 'chosen' | 'routed';
  members: PartyMemberRef[];
  /** Aggregated elemental profile across members. */
  elementBlend: {
    fire: number;
    earth: number;
    air: number;
    water: number;
  };
  /** Aggregated modality profile across members. */
  modalityBlend: {
    cardinal: number;
    fixed: number;
    mutable: number;
  };
  /** High-level tension vs. support balance for the group. */
  tensionIndex: number;
  supportIndex: number;
  /** Distribution of inferred roles within the party (0–1, normalized). */
  roleDistribution: Record<string, number>;
  /** Aggregated domains where the party is collectively strong. */
  sharedStrengthDomains: string[];
  /** Aggregated domains where the party is collectively under-weighted. */
  sharedWeakDomains: string[];
  /** Simple redundancy indicator (0–1): higher means more members share the same dominant role. */
  roleRedundancyIndex: number;
}

export interface PartyRoutingScore {
  partyId: string;
  roleCoverageScore: number;
  elementalBalanceScore: number;
  modalityBalanceScore: number;
  supportComplementScore: number;
  frictionScore: number;
  redundancyPenalty: number;
  shadowRiskPenalty: number;
  /** How strongly this party is routed toward a given domain for challenges. */
  domainWeights: Record<string, number>;
  /** Deterministic scalar used to order parties for a given domain or challenge type. */
  routingScalar: number;
  /** Aggregate score used for matching; higher is preferred. */
  total: number;
}

