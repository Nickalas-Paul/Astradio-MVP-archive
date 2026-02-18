// Social Feed Hook - Fetches and manages social activity feed
// Ready for backend integration with social features

import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '../config/flags';

export type Friend = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  isOnline?: boolean;
  lastActive?: string;
};

export type FeedItem = 
  | { 
      t: 'liked'; 
      userId: string; 
      userName: string;
      compositionId: string; 
      compositionTitle: string;
      at: string;
    }
  | { 
      t: 'published'; 
      userId: string; 
      userName: string;
      compositionId: string; 
      compositionTitle: string;
      genre: string;
      at: string;
    }
  | { 
      t: 'playlist_add'; 
      userId: string; 
      userName: string;
      compositionId: string; 
      compositionTitle: string;
      playlistId: string;
      playlistName: string;
      at: string;
    }
  | { 
      t: 'followed'; 
      userId: string; 
      userName: string;
      targetUserId: string;
      targetUserName: string;
      at: string;
    };

export type SocialFeedResponse = {
  items: FeedItem[];
  cursor?: string;
  hasMore: boolean;
  lastUpdated: string;
};

export function useSocialFeed(cursor?: string, limit: number = 20) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | undefined>(cursor);

  useEffect(() => {
    if (!isFeatureEnabled('ENABLE_SOCIAL')) {
      setItems([]);
      return;
    }

    const fetchFeed = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (nextCursor) params.set('cursor', nextCursor);
        if (limit) params.set('limit', limit.toString());

        const response = await fetch(`/api/social/feed?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch social feed: ${response.status}`);
        }

        const data: SocialFeedResponse = await response.json();
        
        if (nextCursor) {
          // Append to existing items for pagination
          setItems(prev => [...prev, ...data.items]);
        } else {
          // Replace items for initial load
          setItems(data.items);
        }
        
        setHasMore(data.hasMore);
        setNextCursor(data.cursor);
      } catch (err) {
        console.error('[useSocialFeed] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load social feed');
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, [nextCursor, limit]);

  const loadMore = () => {
    if (hasMore && !loading) {
      // Trigger next page load
      setNextCursor(nextCursor);
    }
  };

  const refresh = () => {
    setItems([]);
    setNextCursor(undefined);
    setHasMore(true);
  };

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}

// Hook for managing friends
export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFeatureEnabled('ENABLE_SOCIAL')) {
      setFriends([]);
      return;
    }

    const fetchFriends = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/social/friends');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch friends: ${response.status}`);
        }

        const data: { friends: Friend[] } = await response.json();
        setFriends(data.friends);
      } catch (err) {
        console.error('[useFriends] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load friends');
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, []);

  const followUser = async (targetUserId: string) => {
    if (!isFeatureEnabled('ENABLE_SOCIAL')) {
      throw new Error('Social features are disabled');
    }

    try {
      const response = await fetch('/api/social/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to follow user: ${response.status}`);
      }

      // Refresh friends list
      setFriends([]);
    } catch (err) {
      console.error('[useFriends] Follow error:', err);
      throw err;
    }
  };

  const unfollowUser = async (targetUserId: string) => {
    if (!isFeatureEnabled('ENABLE_SOCIAL')) {
      throw new Error('Social features are disabled');
    }

    try {
      const response = await fetch('/api/social/follow', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to unfollow user: ${response.status}`);
      }

      // Refresh friends list
      setFriends([]);
    } catch (err) {
      console.error('[useFriends] Unfollow error:', err);
      throw err;
    }
  };

  return {
    friends,
    loading,
    error,
    followUser,
    unfollowUser,
    refetch: () => setFriends([]),
  };
}

// Hook for social interactions
export function useSocialActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const likeComposition = async (compositionId: string) => {
    if (!isFeatureEnabled('ENABLE_SOCIAL')) {
      throw new Error('Social features are disabled');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/social/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ compositionId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to like composition: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to like composition';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const shareComposition = async (compositionId: string, platform: string) => {
    if (!isFeatureEnabled('ENABLE_SOCIAL')) {
      throw new Error('Social features are disabled');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/social/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ compositionId, platform }),
      });

      if (!response.ok) {
        throw new Error(`Failed to share composition: ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share composition';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    likeComposition,
    shareComposition,
    loading,
    error,
  };
}

// Mock data for development
export const getMockFeedData = (): FeedItem[] => [
  {
    t: 'published',
    userId: 'user-123',
    userName: 'AstroDJ',
    compositionId: 'comp-456',
    compositionTitle: 'Cosmic House Vibes',
    genre: 'house',
    at: '2025-01-15T10:30:00Z',
  },
  {
    t: 'liked',
    userId: 'user-789',
    userName: 'MoonBeats',
    compositionId: 'comp-789',
    compositionTitle: 'Lunar Ambient',
    at: '2025-01-15T10:15:00Z',
  },
  {
    t: 'playlist_add',
    userId: 'user-456',
    userName: 'StarSax',
    compositionId: 'comp-123',
    compositionTitle: 'Jazz Constellation',
    playlistId: 'playlist-1',
    playlistName: 'My Favorites',
    at: '2025-01-15T10:00:00Z',
  },
  {
    t: 'followed',
    userId: 'user-101',
    userName: 'CosmicVibes',
    targetUserId: 'user-202',
    targetUserName: 'GalaxyBeats',
    at: '2025-01-15T09:45:00Z',
  },
];

export const getMockFriendsData = (): Friend[] => [
  {
    userId: 'user-123',
    displayName: 'AstroDJ',
    avatarUrl: '/mock-avatars/astro-dj.jpg',
    isOnline: true,
    lastActive: '2025-01-15T10:30:00Z',
  },
  {
    userId: 'user-789',
    displayName: 'MoonBeats',
    avatarUrl: '/mock-avatars/moon-beats.jpg',
    isOnline: false,
    lastActive: '2025-01-15T09:15:00Z',
  },
  {
    userId: 'user-456',
    displayName: 'StarSax',
    avatarUrl: '/mock-avatars/star-sax.jpg',
    isOnline: true,
    lastActive: '2025-01-15T10:00:00Z',
  },
];

// Development helpers
export const useMockSocialFeed = () => {
  const [items] = useState(() => getMockFeedData());
  
  return {
    items,
    loading: false,
    error: null,
    hasMore: false,
    loadMore: () => {},
    refresh: () => {},
  };
};

export const useMockFriends = () => {
  const [friends] = useState(() => getMockFriendsData());
  
  return {
    friends,
    loading: false,
    error: null,
    followUser: async () => {},
    unfollowUser: async () => {},
    refetch: () => {},
  };
};
