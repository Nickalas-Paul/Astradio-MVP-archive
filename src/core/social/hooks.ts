import { useEffect, useState, useCallback } from 'react';
import { getApiBaseUrl } from '../api-base';
import { SocialAPI } from './mock-api';
import type { User, Circle, LibraryItem, Playlist, Favorite, Session, UserActivity, LibraryStats } from './types';
import type { CompatMatch } from '../compat/types';

export function useFriends() {
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        setLoading(true);
        const data = await SocialAPI.friends();
        setFriends(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load friends');
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFriends();
  }, []);
  return { friends, loading, error };
}

export function useCircles() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await SocialAPI.circles();
      setCircles(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load circles');
      setCircles([]);
    } finally {
      setLoading(false);
    }
  }, []);
  const create = useCallback(async (name: string) => {
    try {
      await SocialAPI.createCircle(name);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create circle');
    }
  }, [refresh]);
  useEffect(() => { refresh(); }, [refresh]);
  return { circles, create, refresh, loading, error };
}

export function useLibrary(userId?: string) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchLibrary = async () => {
      try {
        setLoading(true);
        const data = await SocialAPI.library(userId);
        setItems(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load library');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLibrary();
  }, [userId]);
  const addItem = useCallback(async (item: LibraryItem) => {
    try {
      await SocialAPI.addToLibrary(item, userId);
      setItems(prev => [...prev, item]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  }, [userId]);
  return { items, addItem, loading, error };
}

export function usePlaylists() {
  const [lists, setLists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const save = useCallback(async (p: Playlist) => {
    try {
      const r = await SocialAPI.upsertPlaylist(p);
      setLists(prev => {
        const i = prev.findIndex(x => x.id === r.id);
        return i >= 0 ? prev.map(x => x.id === r.id ? r : x) : [r, ...prev];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save playlist');
    }
  }, []);
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        setLoading(true);
        const data = await SocialAPI.playlists();
        setLists(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load playlists');
        setLists([]);
      } finally {
        setLoading(false);
      }
    };
    fetchPlaylists();
  }, []);
  return { lists, save, loading, error };
}

export function useFavorites() {
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toggle = useCallback(async (id: string, t: 'composition' | 'pair' | 'chart') => {
    try {
      const isFavorited = await SocialAPI.toggleFavorite(id, t);
      setFavs(await SocialAPI.favorites());
      return isFavorited;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle favorite');
      return false;
    }
  }, []);
  const isFavorited = useCallback((id: string, t: 'composition' | 'pair' | 'chart') => {
    return favs.some(f => f.itemId === id && f.itemType === t);
  }, [favs]);
  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        setLoading(true);
        const data = await SocialAPI.favorites();
        setFavs(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load favorites');
        setFavs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, []);
  return { favs, toggle, isFavorited, loading, error };
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await SocialAPI.sessions();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);
  const create = useCallback(async (title: string, circleId?: string) => {
    try {
      await SocialAPI.createSession(title, circleId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    }
  }, [refresh]);
  const join = useCallback(async (id: string) => {
    try {
      await SocialAPI.joinSession(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session');
    }
  }, [refresh]);
  const leave = useCallback(async (id: string) => {
    try {
      await SocialAPI.leaveSession(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave session');
    }
  }, [refresh]);
  const next = useCallback(async (id: string) => {
    try {
      await SocialAPI.nextTrack(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to skip track');
    }
  }, [refresh]);
  const previous = useCallback(async (id: string) => {
    try {
      await SocialAPI.previousTrack(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to go back');
    }
  }, [refresh]);
  useEffect(() => { refresh(); }, [refresh]);
  return { sessions, create, join, leave, next, previous, refresh, loading, error };
}

export function useLibraryStats(userId?: string) {
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await SocialAPI.getLibraryStats(userId);
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load library stats');
        setStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [userId]);
  return { stats, loading, error };
}

export function useUserActivity(userId?: string) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoading(true);
        const data = await SocialAPI.getUserActivity(userId);
        setActivities(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activities');
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [userId]);
  const addActivity = useCallback(async (activity: Omit<UserActivity, 'id' | 'timestamp'>) => {
    try {
      await SocialAPI.addActivity(activity);
      setActivities(prev => [{ ...activity, id: `act_${Math.random().toString(36).slice(2)}`, timestamp: new Date().toISOString() }, ...prev.slice(0, 99)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add activity');
    }
  }, []);
  return { activities, addActivity, loading, error };
}

// Compatibility hooks
export function useCompat(params: {
  goal: 'friend' | 'romantic' | 'mentor' | 'rival';
  cursor?: string;
  pageSize?: number;
  filters?: {
    distanceKm?: number;
    languages?: string[];
    timeKnown?: number;
    strictBirthTime?: boolean;
  };
}) {
  const [matches, setMatches] = useState<CompatMatch[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const abortController = new AbortController();
    
    try {
      setIsLoading(true);
      // Convert params to query string for GET request
      const queryParams = new URLSearchParams();
      if (params.goal) queryParams.set('goal', params.goal);
      if (params.cursor) queryParams.set('cursor', params.cursor);
      if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
      if (params.filters) {
        Object.entries(params.filters).forEach(([key, value]) => {
          if (value) queryParams.set(`filter_${key}`, value.toString());
        });
      }
      
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/compat/matches?${queryParams.toString()}`, {
        method: 'GET',
        signal: abortController.signal,
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Failed to fetch matches');
      const data = await response.json();
      setMatches(data.matches || []);
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load matches');
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
    
    return () => abortController.abort();
  }, [params.goal, params.cursor, params.pageSize, JSON.stringify(params.filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { matches, nextCursor, isLoading, error, refresh };
}

// Trending tracks hook
export function useTrending(params: {
  window: '24h' | '7d';
  genre?: string;
}) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchTrending = async () => {
      try {
        setIsLoading(true);
        const base = getApiBaseUrl();
        const response = await fetch(`${base || ''}/api/trending?window=${params.window}&genre=${params.genre || ''}`, {
          signal: abortController.signal,
          credentials: 'same-origin'
        });
        if (!response.ok) throw new Error('Failed to fetch trending');
        const data = await response.json();
        setTracks(data.tracks || []);
        setError(null);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load trending');
        setTracks([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTrending();
    
    return () => abortController.abort();
  }, [params.window, params.genre]);

  return { tracks, isLoading, error };
}

// Social feed hook
export function useSocialFeed(params: {
  since?: string;
  cursor?: string;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const abortController = new AbortController();
    
    try {
      setIsLoading(true);
      const base = getApiBaseUrl();
      let url = (base || '') + '/api/community/feed';
      const searchParams = new URLSearchParams();
      if (params.since) searchParams.set('since', params.since);
      if (params.cursor) searchParams.set('cursor', params.cursor);
      if (searchParams.toString()) url += '?' + searchParams.toString();
      
      const response = await fetch(url, {
        signal: abortController.signal,
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Failed to fetch feed');
      const data = await response.json();
      setItems(data.items || []);
      setNextCursor(data.nextCursor);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setItems([]);
    } finally {
      setIsLoading(false);
    }
    
    return () => abortController.abort();
  }, [params.since, params.cursor]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, nextCursor, isLoading, error, refresh };
}

// Social actions hook
export function useSocialActions() {
  const connect = useCallback(async (userId: string, goal: string) => {
    try {
      const response = await fetch(`/api/connect/${userId}?goal=${goal}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Failed to connect');
      return await response.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Connection failed');
    }
  }, []);

  const accept = useCallback(async (requestId: string) => {
    try {
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/connect/accept/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Failed to accept');
      return await response.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Accept failed');
    }
  }, []);

  const saveTrack = useCallback(async (trackId: string) => {
    try {
      const response = await fetch(`/api/save/${trackId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Failed to save track');
      return await response.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Save failed');
    }
  }, []);

  const like = useCallback(async (itemId: string) => {
    try {
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/like/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Failed to like');
      return await response.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Like failed');
    }
  }, []);

  const report = useCallback(async (itemId: string, reason: string) => {
    try {
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, reason }),
        credentials: 'same-origin'
      });
      if (!response.ok) throw new Error('Failed to report');
      return await response.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Report failed');
    }
  }, []);

  return { connect, accept, saveTrack, like, report };
}

