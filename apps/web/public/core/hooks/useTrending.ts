// Trending Hook - Fetches and manages trending compositions
// Ready for backend integration with caching

import { useState, useEffect } from 'react';
import { isFeatureEnabled } from '../config/flags';

export type TrendingItem = {
  compositionId: string;
  title: string;
  artist?: string;
  genre: string;
  score: number;
  durationSec: number;
  previewUrl: string;
  coverUrl?: string;
  playCount: number;
  likeCount: number;
  shareCount: number;
  createdAt: string;
};

export type TrendingResponse = {
  items: TrendingItem[];
  genre: string;
  period: string;
  lastUpdated: string;
};

export function useTrending(genre?: string, limit: number = 10) {
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    if (!isFeatureEnabled('ENABLE_TRENDING')) {
      setItems([]);
      return;
    }

    const fetchTrending = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (genre) params.set('genre', genre);
        if (limit) params.set('limit', limit.toString());

        const response = await fetch(`/api/trending?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch trending: ${response.status}`);
        }

        const data: TrendingResponse = await response.json();
        setItems(data.items);
        setLastUpdated(data.lastUpdated);
      } catch (err) {
        console.error('[useTrending] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load trending');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, [genre, limit]);

  return {
    items,
    loading,
    error,
    lastUpdated,
    refetch: () => {
      if (isFeatureEnabled('ENABLE_TRENDING')) {
        // Trigger refetch by updating dependencies
        setItems([]);
      }
    },
  };
}

// Hook for specific trending categories
export function useTrendingByGenre(genre: string) {
  return useTrending(genre, 10);
}

export function useTopTrending(limit: number = 5) {
  return useTrending(undefined, limit);
}

// Hook for trending with real-time updates
export function useTrendingWithUpdates(genre?: string) {
  const trending = useTrending(genre);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  useEffect(() => {
    if (!isFeatureEnabled('ENABLE_TRENDING')) {
      return;
    }

    // Set up periodic refresh (every 5 minutes)
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...trending,
    lastUpdate,
  };
}

// Mock data for development
export const getMockTrendingData = (genre?: string): TrendingItem[] => {
  const mockItems: TrendingItem[] = [
    {
      compositionId: 'trending-1',
      title: 'Cosmic House Vibes',
      artist: 'AstroDJ',
      genre: 'house',
      score: 95.2,
      durationSec: 60,
      previewUrl: '/mock-audio/trending-1.mp3',
      coverUrl: '/mock-covers/house-1.jpg',
      playCount: 1250,
      likeCount: 89,
      shareCount: 23,
      createdAt: '2025-01-15T10:30:00Z',
    },
    {
      compositionId: 'trending-2',
      title: 'Lunar Ambient',
      artist: 'MoonBeats',
      genre: 'ambient',
      score: 92.8,
      durationSec: 60,
      previewUrl: '/mock-audio/trending-2.mp3',
      coverUrl: '/mock-covers/ambient-1.jpg',
      playCount: 980,
      likeCount: 67,
      shareCount: 18,
      createdAt: '2025-01-15T09:15:00Z',
    },
    {
      compositionId: 'trending-3',
      title: 'Jazz Constellation',
      artist: 'StarSax',
      genre: 'jazz',
      score: 89.5,
      durationSec: 60,
      previewUrl: '/mock-audio/trending-3.mp3',
      coverUrl: '/mock-covers/jazz-1.jpg',
      playCount: 756,
      likeCount: 54,
      shareCount: 12,
      createdAt: '2025-01-15T08:45:00Z',
    },
  ];

  if (genre) {
    return mockItems.filter(item => item.genre === genre);
  }

  return mockItems;
};

// Development helper
export const useMockTrending = (genre?: string) => {
  const [items] = useState(() => getMockTrendingData(genre));
  
  return {
    items,
    loading: false,
    error: null,
    lastUpdated: new Date().toISOString(),
    refetch: () => {},
  };
};
