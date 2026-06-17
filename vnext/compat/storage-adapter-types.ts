export interface MatchCandidate {
  chartId: string;
  userId: string;
  displayName: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
  discoverableAs?: string;
  lookingFor?: string;
  chartHighlights?: string[];
}
