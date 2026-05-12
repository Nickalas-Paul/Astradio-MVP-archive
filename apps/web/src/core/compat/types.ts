// Compatibility Types
// Shared types for compatibility matching system

export type ChartID = string;

export type CompatFacet = {
  id: string;
  name: string;
  weight: number;
  score: number;
  explanation: string;
};

export type SynFeature = {
  name: string;
  value: number;
  description: string;
};

export type ScoreArgs = {
  chartA: ChartID;
  chartB: ChartID;
  featuresA: SynFeature[];
  featuresB: SynFeature[];
};

export type ScoreResult = {
  overall: number;
  facets: CompatFacet[];
  rationale: string;
  confidence: number;
};

/** Mirrors server `CompatibilityExplanationProfile` (discovery / matches API). */
export type CompatibilityExplanationProfile = {
  intent: 'friend' | 'lover';
  intentFitSummary: string;
  primarySupports: string[];
  secondarySupports: string[];
  tensionsOrLimits: string[];
  contrastByIntent: {
    friend: 'high' | 'moderate' | 'low';
    lover: 'high' | 'moderate' | 'low';
  };
  anchors: string[];
};

export type CompatMatch = {
  userId: string;
  chartId: ChartID;
  displayName: string;
  score: number;
  facets: CompatFacet[];
  rationale: string;
  explanationProfile: CompatibilityExplanationProfile;
  lastUpdated: string;
  compatibilityFieldHash: string;
  bio?: string;
  avatarUrl?: string;
  lookingFor?: string;
};

export type CompatCacheEntry = {
  userId: string;
  matches: CompatMatch[];
  timestamp: number;
  ttl: number;
};

export type CreateProfileRequest = {
  userId: string;
  chartId: ChartID;
  preferences: {
    minScore: number;
    maxDistance: number;
    preferredFacets: string[];
  };
};

export type UpdateProfileRequest = {
  userId: string;
  preferences: Partial<CreateProfileRequest['preferences']>;
};

export type GenerateMatchesRequest = {
  userId: string;
  limit?: number;
  refresh?: boolean;
};

export type RationaleRequest = {
  userId: string;
  targetUserId: string;
};

export type RationaleResponse = {
  score: number;
  facets: CompatFacet[];
  explanation: string;
  confidence: number;
};
