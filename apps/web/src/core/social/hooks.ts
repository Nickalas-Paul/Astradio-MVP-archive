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

// Profile (stub user + primary chart + chart explainer)
export interface ProfileUser {
  id: string;
  displayName: string;
  handle?: string;
  /** Phase 8G: when true, profile appears in community search. Default true. */
  discoverable?: boolean;
  /** Phase 8G: when true, may appear in community feed. Default true. */
  show_in_feed?: boolean;
}
export interface ProfilePrimaryChart {
  id: string;
  label: string;
  date: string;
  time: string;
  lat: number;
  lon: number;
  timezone?: string;
}
export interface ProfileChartSection {
  id: string;
  title: string;
  text: string;
  bullets?: string[];
}
export interface ProfileChartResponse {
  chart: ProfilePrimaryChart & { createdAt?: string; updatedAt?: string };
  snapshot: Record<string, unknown>;
  explainer: { spec: string; sections: ProfileChartSection[] };
  meta: { encoderVersion?: string; explainerVersion?: string; generatedAt: string };
}

export function useProfile() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [primaryChart, setPrimaryChart] = useState<ProfilePrimaryChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`${getApiBaseUrl() || ''}/api/profile`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('Failed to fetch profile');
      const data = await r.json();
      setUser(data.user ?? null);
      setPrimaryChart(data.primaryChart ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      setUser(null);
      setPrimaryChart(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, primaryChart, loading, error, refresh };
}

export function useProfileChart(chartId: string | null) {
  const [data, setData] = useState<ProfileChartResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!chartId) {
      setData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const r = await fetch(
        `${getApiBaseUrl() || ''}/api/profile/chart?chartId=${encodeURIComponent(chartId)}`,
        { credentials: 'same-origin' }
      );
      if (!r.ok) throw new Error('Failed to fetch profile chart');
      const json = await r.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chart explainer');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [chartId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// Directory user (community search)
export interface DirectoryUser {
  userId: string;
  displayName: string;
  handle?: string;
  chartId: string;
  label?: string;
  locationLabel?: string;
}

export function useUserSearch(params: { q: string; limit?: number; cursor?: string }) {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQ, setDebouncedQ] = useState(params.q);
  const limit = params.limit ?? 10;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(params.q), 250);
    return () => clearTimeout(t);
  }, [params.q]);

  const search = useCallback(async () => {
    const trimmed = (debouncedQ || '').trim();
    if (trimmed.length < 2) {
      setUsers([]);
      setNextCursor(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams();
      qp.set('q', trimmed);
      qp.set('limit', String(limit));
      if (params.cursor) qp.set('cursor', params.cursor);
      const r = await fetch(
        `${getApiBaseUrl() || ''}/api/community/search?${qp.toString()}`,
        { credentials: 'same-origin', cache: 'no-store' }
      );
      if (!r.ok) throw new Error('Search failed');
      const data = await r.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
      setNextCursor(data.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setUsers([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, limit, params.cursor]);

  useEffect(() => {
    search();
  }, [search]);

  return { users, nextCursor, loading, error, refresh: search };
}

// Compatibility hooks. Standard params: chartId, mode, limit, cursor. goal/pageSize accepted as backward-compat aliases (goal→mode, pageSize→limit).
function goalToMode(goal?: string): 'friend' | 'lover' | 'rival' {
  if (goal === 'lover' || goal === 'romantic') return 'lover';
  if (goal === 'rival') return 'rival';
  return 'friend';
}

export function useCompat(params: {
  chartId: string | null;
  mode?: 'friend' | 'lover' | 'rival';
  cursor?: string;
  pageSize?: number;
  limit?: number;
  /** @deprecated Use mode. Maps romantic→lover, rival→rival, else→friend */
  goal?: 'friend' | 'romantic' | 'mentor' | 'rival';
  facets?: string[];
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

  const effectiveMode = params.mode ?? goalToMode(params.goal);
  const effectiveLimit = params.limit ?? params.pageSize ?? 10;

  const refresh = useCallback(async () => {
    if (!params.chartId) {
      setMatches([]);
      setIsLoading(false);
      return;
    }
    const abortController = new AbortController();
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams();
      queryParams.set('chartId', params.chartId);
      queryParams.set('mode', effectiveMode);
      queryParams.set('limit', String(effectiveLimit));
      if (params.cursor) queryParams.set('cursor', params.cursor);
      if (params.facets?.length) queryParams.set('facets', params.facets.join(','));
      if (params.filters) {
        Object.entries(params.filters).forEach(([key, value]) => {
          if (value) queryParams.set(`filter_${key}`, value.toString());
        });
      }
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/compat/matches?${queryParams.toString()}`, {
        method: 'GET',
        signal: abortController.signal,
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Failed to fetch matches');
      const data = await response.json();
      setMatches(Array.isArray(data.matches) ? data.matches : []);
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
  }, [params.chartId, effectiveMode, effectiveLimit, params.cursor, params.facets, JSON.stringify(params.filters)]);

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
      // Phase 8G: merge posts and recentJoins into one list (backend returns { posts, recentJoins })
      const postItems = (data.posts || []).map((p: { id: string; title?: string; body?: string; createdAt?: string; author?: { displayName?: string } }) => ({
        t: 'post',
        id: p.id,
        userName: p.author?.displayName ?? 'Someone',
        title: p.title ?? '',
        body: p.body ?? '',
        at: p.createdAt ?? new Date().toISOString(),
      }));
      const joinItems = (data.recentJoins || []).map((j: { userId: string; displayName?: string; createdAt?: string }) => ({
        t: 'joined',
        id: j.userId,
        userName: j.displayName ?? 'Someone',
        at: j.createdAt ?? new Date().toISOString(),
      }));
      const merged = [...postItems, ...joinItems].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setItems(merged);
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
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/connect/${userId}?goal=${goal}`, {
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
      const base = getApiBaseUrl();
      const response = await fetch(`${base || ''}/api/save/${trackId}`, {
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

