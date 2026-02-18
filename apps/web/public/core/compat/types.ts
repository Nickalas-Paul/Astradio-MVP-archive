// Compatibility Matching Types
// Defines contracts for chart compatibility scoring and matching

export type ChartID = string;
export type UserID = string;

export type CompatFacet = 'friends' | 'lovers' | 'creative' | 'mentor' | 'conflict' | 'overall';

export type CompatProfile = {
  userId: UserID;
  chartId: ChartID;
  // normalized 64-D vector from engine feature encoder (rule/teacher)
  features64: number[];             // length 64, -1..+1
  prefs?: {                         // optional user sliders (0..1)
    energy?: number; 
    mood?: number; 
    complexity?: number;
    novelty?: number; 
    stability?: number;
  };
  visibility: 'private' | 'friends' | 'public';
  updatedAt: string; // ISO
};

export type CompatMatch = {
  targetUserId: UserID;
  targetChartId: ChartID;
  facet: CompatFacet;
  score: number;          // 0..1
  rationale: string[];    // short bullet reasons
  previewCompId?: string; // optional composition to play
};

export type CompatQuery = {
  chartId: ChartID;
  facets?: CompatFacet[];     // default ['overall']
  limit?: number;             // default 10
  cursor?: string;
};

export type CompatResponse = {
  matches: CompatMatch[];
  facet: CompatFacet;
  cursor?: string;
  hasMore: boolean;
  lastUpdated: string;
};

// Synastry features for scoring
export type SynFeature = {
  aspect: 'conj' | 'trine' | 'sextile' | 'square' | 'opp' | 'quincunx';
  bodies: [string, string];    // e.g., ['Venus','Mars']
  orbDeg: number;             // 0..10
  strength: number;           // 0..1 after orb falloff
  houseOverlay?: { planet: string; house: number };
  dignity?: 'domicile' | 'exalt' | 'detriment' | 'fall' | null;
};

// Scoring arguments
export type ScoreArgs = {
  facet: CompatFacet;
  A: { features64: number[] };
  B: { features64: number[] };
  syn: SynFeature[];        // computed via existing ephemeris path
};

// Scoring result
export type ScoreResult = {
  score: number;            // 0..1
  rationale: string[];      // bullet points
  breakdown?: {             // optional detailed breakdown
    baseSimilarity: number;
    bonuses: number;
    penalties: number;
    finalScore: number;
  };
};

// Cache entry
export type CompatCacheEntry = {
  chartId: ChartID;
  facet: CompatFacet;
  rank: number;
  targetUserId: UserID;
  targetChartId: ChartID;
  score: number;
  rationale: string[];
  updatedAt: string;
};

// Profile creation request
export type CreateProfileRequest = {
  userId: UserID;
  chartId: ChartID;
  prefs?: CompatProfile['prefs'];
  visibility?: CompatProfile['visibility'];
};

// Profile update request
export type UpdateProfileRequest = {
  userId: UserID;
  chartId: ChartID;
  prefs?: CompatProfile['prefs'];
  visibility?: CompatProfile['visibility'];
};

// Match generation request
export type GenerateMatchesRequest = {
  chartId: ChartID;
  facets?: CompatFacet[];
  limit?: number;
  forceRefresh?: boolean;
};

// Rationale detail request
export type RationaleRequest = {
  chartIdA: ChartID;
  chartIdB: ChartID;
  facet: CompatFacet;
};

// Rationale detail response
export type RationaleResponse = {
  facet: CompatFacet;
  score: number;
  rationale: string[];
  synFeatures: SynFeature[];
  breakdown: {
    baseSimilarity: number;
    bonuses: number;
    penalties: number;
    finalScore: number;
  };
};
