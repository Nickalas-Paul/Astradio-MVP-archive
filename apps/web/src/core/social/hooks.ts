import { useEffect, useState, useCallback } from 'react';
import { getApiBaseUrl } from '../api-base';
import { SocialAPI } from './mock-api';
import type { User, Circle, LibraryItem, Playlist, Favorite, Session, UserActivity, LibraryStats } from './types';
import type { CompatMatch } from '../compat/types';
import type { RelationalIntent } from '../../lib/relational-intent';

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
export interface ProfileChartIdentity {
  profile_contract_version: number;
  natal_snapshot_fingerprint: string;
  profile_natal_compose_anchor: string;
  object_identity_hash: string;
  surface_kind: 'profile_natal';
}

export interface ProfileChartResponse {
  chart: ProfilePrimaryChart & { createdAt?: string; updatedAt?: string };
  identity_export_id?: string | null;
  snapshot: Record<string, unknown>;
  explainer: {
    spec: string;
    sections: ProfileChartSection[];
    meta?: { canonical_object_hash: string };
  };
  meta: { encoderVersion?: string; explainerVersion?: string; generatedAt: string };
  identity?: ProfileChartIdentity;
  hashes?: { plan_sha256: string; object_identity_hash: string };
  personality?: {
    temperament?: { activation?: number; stability?: number; expressiveness?: number };
    emphasis?: Record<string, number>;
  };
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
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          typeof (json as { error?: string }).error === 'string'
            ? (json as { error: string }).error
            : `Could not load chart preview (${r.status})`;
        throw new Error(msg);
      }
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
function goalToMode(goal?: string): RelationalIntent {
  if (goal === 'lover' || goal === 'romantic') return 'lover';
  if (goal === 'rival' || goal === 'collaborator' || goal === 'mentor') return 'friend';
  return 'friend';
}

export function useCompat(params: {
  chartId: string | null;
  mode?: RelationalIntent;
  cursor?: string;
  pageSize?: number;
  limit?: number;
  /** @deprecated Use mode. Maps romantic→lover, legacy rival/mentor→friend, else→friend */
  goal?: 'friend' | 'romantic' | 'mentor' | 'rival' | 'collaborator';
  facets?: string[];
  filters?: {
    distanceKm?: number;
    languages?: string[];
    timeKnown?: number;
    strictBirthTime?: boolean;
  };
}) {
  /** null = not loaded; [] = loaded, no results */
  const [matches, setMatches] = useState<CompatMatch[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [responseMode, setResponseMode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveMode = params.mode ?? goalToMode(params.goal);
  const effectiveLimit = params.limit ?? params.pageSize ?? 10;
  const filtersKey = params.filters ? JSON.stringify(params.filters) : '';

  useEffect(() => {
    setMatches(null);
    setNextCursor(undefined);
    setResponseMode(null);
    setError(null);
    setIsLoading(false);
  }, [params.chartId]);

  const run = useCallback(async () => {
    if (!params.chartId) {
      setMatches([]);
      setNextCursor(undefined);
      setResponseMode(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const abortController = new AbortController();
    try {
      setIsLoading(true);
      setError(null);
      setResponseMode(null);
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
      setResponseMode(typeof data.mode === 'string' ? data.mode : null);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to load matches');
      setMatches([]);
      setResponseMode(null);
    } finally {
      setIsLoading(false);
    }
  }, [params.chartId, effectiveMode, effectiveLimit, params.cursor, params.facets, filtersKey]);

  return { matches, nextCursor, responseMode, isLoading, error, run, refresh: run };
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

/** Transit for relational feed: current instant in primary chart timezone + chart coordinates. */
export function buildRelationalFeedTransitFromPrimaryChart(
  chart: ProfilePrimaryChart | null
): { date: string; time: string; lat: number; lon: number; timezone?: string } | null {
  if (!chart || typeof chart.lat !== 'number' || typeof chart.lon !== 'number') return null;
  const tz = (chart.timezone && chart.timezone.trim()) || 'UTC';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const y = pick('year');
  const mo = pick('month');
  const d = pick('day');
  const h = pick('hour');
  const mi = pick('minute');
  if (!y || !mo || !d) return null;
  return {
    date: `${y}-${mo}-${d}`,
    time: `${h || '00'}:${mi || '00'}`,
    lat: chart.lat,
    lon: chart.lon,
    timezone: tz,
  };
}

export interface RelationalCommunityFeedItem {
  feed_item_id: string;
  connection_kind: string;
  binding_id: string;
  chart_ids_ordered: string[];
  /** User-facing identity line when provided by API (graceful fallback in UI if absent). */
  connection_identity_line?: string;
  collapsed_display?: {
    primary_line: string;
    micro_tag: string;
    activation_descriptor: string;
    /** Phase 6D Beta — pair-only; three fixed activation lines with viewer/partner framing. */
    enhanced_title?: string;
    activity_count?: number;
    activation_lines?: Array<{ text: string; member_scope: 'you' | 'them' | 'shared' }>;
  };
  compatibility_field_hash: string;
  relational_weather_state_hash: string | null;
  transit_snapshot_hash: string;
  ranking: {
    weather_activation_intensity: number;
    activation_effective: number;
    overall_relational_intensity: number;
    tie_break_key: string;
  };
  artifactStatus?: 'not_generated' | 'available' | 'partial' | 'failed';
}

export interface RelationalCommunityFeedResponse {
  version: string;
  sort_tuple_version: string;
  transit_lock: Record<string, unknown>;
  items: RelationalCommunityFeedItem[];
  transit_snapshot_hash?: string;
  relational_weather_state_hash?: string | null;
  generated_at?: string;
}

/** Established connections only; server-side sort. No client reordering. */
export function useRelationalCommunityFeed(userId: string | null, primaryChart: ProfilePrimaryChart | null) {
  const [data, setData] = useState<RelationalCommunityFeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const transit = buildRelationalFeedTransitFromPrimaryChart(primaryChart);
    if (!transit) {
      setData(null);
      setError(
        'Complete your profile with a resolved birth place (search and select a location) so the feed can run.'
      );
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const base = getApiBaseUrl();
      const r = await fetch(`${base || ''}/api/community/relational-feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ transit }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error || `Feed request failed (${r.status})`);
      }
      const json = (await r.json()) as RelationalCommunityFeedResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, primaryChart]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}

// Social actions hook
export function useSocialActions() {
  const connect = useCallback(async () => {
    throw new Error('Deprecated: use Community → Discovery → Request connection (connection-intent flow).');
  }, []);

  const accept = useCallback(async () => {
    throw new Error('Deprecated: use Community → Connections → accept incoming request.');
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

/** Phase 8 — durable Community inventory (pairs, relational groups, campaigns, pending intents). */
export type CommunityFeedSkeletonItemV1 = {
  kind: string;
  bindingId: string;
  sortAt?: string;
  feedKey: string;
};

/** Pairs: comparisonId = reading; exportJobId set when audio stored. Groups: reading_snapshot = composite; exportJobId on group row. */
export type CommunityArtifactStatusV1 = 'not_generated' | 'text_available' | 'audio_available';

export type CommunityInventoryV1 = {
  version: string;
  userId: string;
  pairs: Array<Record<string, unknown>>;
  relationalGroups: Array<Record<string, unknown>>;
  campaigns: Array<Record<string, unknown>>;
  pendingIncomingIntents: Array<Record<string, unknown>>;
  pendingOutgoingIntents: Array<Record<string, unknown>>;
  pendingRelationalGroupInvites: Array<Record<string, unknown>>;
  feedSkeleton: CommunityFeedSkeletonItemV1[];
};

export function useCommunityInventory() {
  const [data, setData] = useState<CommunityInventoryV1 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch(`${getApiBaseUrl() || ''}/api/community/inventory`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : `Inventory ${r.status}`);
      }
      setData(json as CommunityInventoryV1);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inventory failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

