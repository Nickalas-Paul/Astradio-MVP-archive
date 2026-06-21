/** GET /api/community/inventory */
export type CommunityInventoryResponse = {
  version: 'community_inventory_v1';
  userId: string;
  pairs: InventoryPair[];
  relationalGroups: unknown[];
  campaigns: unknown[];
  pendingIncomingIntents: PendingIntent[];
  pendingOutgoingIntents: PendingIntent[];
  pendingRelationalGroupInvites: unknown[];
  feedSkeleton: unknown[];
};

/** Relationship row enriched for viewer — API field is `id`, not relationshipId. */
export type InventoryPair = {
  id: string;
  ownerUserId: string;
  chartIdLow: string;
  chartIdHigh: string;
  label: string;
  comparisonId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  peerUserId: string | null;
  peerChartId: string | null;
  peerDisplayName?: string;
  peerHandle?: string;
  /** Sun / moon / rising sign names from peer chart snapshot (inventory enrichment). */
  peerBigThree?: {
    sun: string;
    moon: string;
    rising?: string;
  };
  exportJobId?: string | null;
  artifactStatus: 'not_generated' | 'text_available' | 'audio_available' | string;
};

export type PendingIntent = {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromDisplayName?: string;
  fromHandle?: string;
  toDisplayName?: string;
  toHandle?: string;
  chartId?: string;
  fromChartId?: string;
  toChartId?: string;
  label?: string;
  relationshipKind?: string;
  status?: string;
  createdAt: string;
  acceptedAt?: string | null;
};

/** GET /api/community/search — users[].userId (not id). */
export type SearchUser = {
  userId: string;
  displayName: string;
  handle: string;
  chartId: string;
  bio?: string;
  avatarUrl?: string;
  discoverableAs?: string;
  chartHighlights?: string[];
};

export type SearchResponse = {
  q: string;
  users: SearchUser[];
};

export type SynastryBulletLine = { anchor: string; text: string };

export type CompatibilityExplanationProfile = {
  intent: 'friend' | 'lover';
  intentFitSummary: string;
  primarySupports: string[];
  secondarySupports: string[];
  tensionsOrLimits: string[];
  synastryBullets?: {
    forYou: SynastryBulletLine;
    forThem: SynastryBulletLine;
    together: SynastryBulletLine;
  };
};

/** GET /api/compat/matches — score/rationale/facets stripped by toPublicCompatMatch. */
export type MatchResult = {
  userId: string;
  chartId: string;
  displayName: string;
  handle?: string;
  explanationProfile?: CompatibilityExplanationProfile;
  lastUpdated: string;
  compatibilityFieldHash?: string;
  bio?: string;
  avatarUrl?: string;
  lookingFor?: string;
  chartHighlights?: string[];
};

export type MatchesResponse = {
  chartId: string;
  mode: string;
  limit: number;
  matches: MatchResult[];
  generatedAt: string;
  version?: string;
  synastryEnabled?: boolean;
  matchesMock?: boolean;
};

export type ConnectIntentResponse = PendingIntent;

export type IntentActionResponse = {
  ok: boolean;
  intentId?: string;
  error?: string;
};
