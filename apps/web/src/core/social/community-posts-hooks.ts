'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/core/api-base';

export interface CommunityAuthor {
  displayName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
}

export interface CommunityPost {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: CommunityAuthor;
  imageUrl?: string | null;
  audioExportId?: string | null;
  audioLabel?: string | null;
  likeCount?: number;
  commentCount?: number;
  likedByViewer?: boolean;
  viewerLikeId?: string | null;
}

export interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author?: CommunityAuthor;
}

export interface CommunityPublicProfile {
  userId: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string | null;
  bio: string;
  keywords: string[];
  publicVisibility: boolean;
  postCount: number;
  recentPosts: CommunityPost[];
}

export interface CommunityUserSettings {
  userId: string;
  bio: string;
  publicVisibility: boolean;
  keywords: string[];
  updatedAt: string | null;
}

const api = (path: string) => `${getApiBaseUrl() || ''}${path}`;

async function parseJson<T>(r: Response): Promise<T> {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = typeof (data as { error?: string }).error === 'string' ? (data as { error: string }).error : undefined;
    const msg =
      typeof (data as { message?: string }).message === 'string'
        ? (data as { message: string }).message
        : code || r.statusText || `Request failed (${r.status})`;
    const err = new Error(msg) as Error & { code?: string };
    if (code) err.code = code;
    throw err;
  }
  return data as T;
}

export function useCommunityFeed(pageSize = 20) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const loadPage = useCallback(async (nextOffset: number, append: boolean) => {
    const r = await fetch(api(`/api/community/feed?limit=${pageSize}&offset=${nextOffset}`), {
      credentials: 'same-origin',
    });
    const data = await parseJson<{
      posts: CommunityPost[];
      pagination: { hasMore: boolean; offset: number };
    }>(r);
    setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
    setHasMore(!!data.pagination?.hasMore);
    setOffset(nextOffset + data.posts.length);
  }, [pageSize]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setOffset(0);
      await loadPage(0, false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      await loadPage(offset, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadPage, loadingMore, offset]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const prependPost = useCallback((post: CommunityPost) => {
    setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
  }, []);

  const patchPost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  return { posts, loading, loadingMore, error, hasMore, refresh, loadMore, prependPost, patchPost };
}

export function useCommunityPost(postId: string | null) {
  const [post, setPost] = useState<(CommunityPost & { comments?: CommunityComment[] }) | null>(null);
  const [loading, setLoading] = useState(!!postId);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!postId) return;
    try {
      setLoading(true);
      const r = await fetch(api(`/api/community/posts/${encodeURIComponent(postId)}`), {
        credentials: 'same-origin',
      });
      const data = await parseJson<CommunityPost & { comments: CommunityComment[] }>(r);
      setPost(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load post');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { post, loading, error, refresh, setPost };
}

export function useCommunityPublicProfile(userId: string | null) {
  const [profile, setProfile] = useState<CommunityPublicProfile | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(api(`/api/community/profile/${encodeURIComponent(userId)}`), {
          credentials: 'same-origin',
        });
        const data = await parseJson<CommunityPublicProfile>(r);
        if (!cancelled) {
          setProfile(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load profile');
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, loading, error };
}

export function useCommunitySettings() {
  const [settings, setSettings] = useState<CommunityUserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { user } = await parseJson<{ user: { id: string } | null }>(
        await fetch(api('/api/profile'), { credentials: 'same-origin' })
      );
      if (!user?.id) {
        setSettings(null);
        return;
      }
      const r = await fetch(api(`/api/community/profile/${encodeURIComponent(user.id)}`), {
        credentials: 'same-origin',
      });
      if (r.status === 404) {
        setSettings({
          userId: user.id,
          bio: '',
          publicVisibility: true,
          keywords: [],
          updatedAt: null,
        });
        return;
      }
      const profile = await parseJson<CommunityPublicProfile>(r);
      setSettings({
        userId: profile.userId,
        bio: profile.bio,
        publicVisibility: profile.publicVisibility,
        keywords: profile.keywords,
        updatedAt: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (input: Partial<CommunityUserSettings>) => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(api('/api/community/settings'), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: input.bio,
          publicVisibility: input.publicVisibility,
          keywords: input.keywords,
        }),
      });
      const data = await parseJson<CommunityUserSettings>(r);
      setSettings(data);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save settings';
      setError(msg);
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, saving, error, save, refresh };
}

export async function createCommunityPost(input: { title?: string; body: string }) {
  const r = await fetch(api('/api/community/posts'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<CommunityPost>(r);
}

export async function likeCommunityPost(postId: string) {
  const r = await fetch(api('/api/community/likes'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId }),
  });
  return parseJson<{ id: string; postId: string }>(r);
}

export async function unlikeCommunityPost(likeId: string) {
  const r = await fetch(api(`/api/community/likes/${encodeURIComponent(likeId)}`), {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return parseJson<{ ok: boolean }>(r);
}

export async function createCommunityComment(postId: string, body: string) {
  const r = await fetch(api('/api/community/comments'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, body }),
  });
  return parseJson<CommunityComment>(r);
}
