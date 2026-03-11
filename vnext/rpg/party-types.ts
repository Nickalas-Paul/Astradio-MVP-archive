export interface PartyMemberRef {
  userId: string;
  chartId: string;
}

export interface PartyProfile {
  id: string;
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
}

export interface PartyRoutingScore {
  partyId: string;
  /** How strongly this party is routed toward a given domain for challenges. */
  domainWeights: Record<string, number>;
  /** Deterministic scalar used to order parties for a given domain or challenge type. */
  routingScalar: number;
}

