// Social Hooks
// React hooks for community features

import { useEffect, useState, useCallback } from 'react';
import { SocialAPI } from './mock-api';
import type { User, Circle, LibraryItem, Playlist, Favorite, Session, UserActivity, LibraryStats } from './types';

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

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  useEffect(() => {
    refresh();
  }, [refresh]);

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
      setActivities(prev => [{
        ...activity,
        id: `act_${Math.random().toString(36).slice(2)}`,
        timestamp: new Date().toISOString()
      }, ...prev.slice(0, 99)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add activity');
    }
  }, []);

  return { activities, addActivity, loading, error };
}
