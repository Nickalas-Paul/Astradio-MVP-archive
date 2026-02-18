// Social & Community Types
// Complete type system for people, circles, sessions, and library

export type UserID = string;
export type ChartID = string;
export type CompositionID = string;
export type CircleID = string;
export type SessionID = string;
export type WikiID = string;

export type User = {
  id: UserID;
  handle: string;            // @name
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  visibility: 'private' | 'friends' | 'public';
};

export type FriendEdge = { 
  userId: UserID; 
  friendId: UserID; 
  createdAt: string;
};

export type Circle = {
  id: CircleID;
  name: string;
  ownerId: UserID;
  memberIds: UserID[];
  inviteCode?: string;       // optional for easy joins
  createdAt: string;
};

export type LibraryItem =
  | { t: 'composition'; id: CompositionID; title: string; genre: string; durationSec: number; previewUrl?: string }
  | { t: 'pair'; id: string; chartA: ChartID; chartB?: ChartID; label: string }
  | { t: 'chart'; id: ChartID; label: string };

export type Playlist = {
  id: string;
  ownerId: UserID;
  title: string;
  items: LibraryItem[];
  createdAt: string;
  updatedAt: string;
};

export type Favorite = { 
  userId: UserID; 
  itemId: string; 
  itemType: LibraryItem['t']; 
  createdAt: string;
};

export type Session = {
  id: SessionID;
  hostId: UserID;
  title: string;
  circleId?: CircleID;
  queue: LibraryItem[];          // mock audio ok
  currentIndex: number;
  participants: UserID[];
  createdAt: string;
};

export type WikiArticle = {
  id: WikiID;           // e.g., "planet.venus", "aspect.square", "house.7"
  title: string;
  kind: 'planet' | 'sign' | 'house' | 'aspect' | 'transit' | 'concept';
  summary: string;
  bodyMD?: string;      // embedded MD/MDX fallback
  links?: WikiID[];
  updatedAt: string;
};

export type TransitExplainer = {
  id: string;                     // "venus-trine-mars"
  title: string;
  tags: string[];                 // ['venus','trine','mars']
  excerpt: string;
  bodyMD?: string;
};

// Additional types for enhanced functionality
export type ChatMessage = {
  id: string;
  sessionId: SessionID;
  userId: UserID;
  message: string;
  timestamp: string;
};

export type SessionEvent = {
  id: string;
  sessionId: SessionID;
  type: 'join' | 'leave' | 'play' | 'pause' | 'next' | 'chat';
  userId: UserID;
  data?: any;
  timestamp: string;
};

export type UserActivity = {
  id: string;
  userId: UserID;
  type: 'composition' | 'pair' | 'favorite' | 'session_join' | 'session_create';
  itemId?: string;
  itemType?: LibraryItem['t'];
  timestamp: string;
};

export type CircleInvite = {
  id: string;
  circleId: CircleID;
  inviteCode: string;
  createdBy: UserID;
  expiresAt: string;
  maxUses?: number;
  usedCount: number;
};

export type LibraryStats = {
  totalItems: number;
  compositions: number;
  pairs: number;
  charts: number;
  playlists: number;
  favorites: number;
  recentActivity: UserActivity[];
};

export type SessionStats = {
  totalSessions: number;
  activeSessions: number;
  totalParticipants: number;
  averageSessionDuration: number;
  popularGenres: string[];
};
