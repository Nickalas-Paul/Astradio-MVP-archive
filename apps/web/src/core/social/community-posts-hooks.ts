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
  hashtags?: string[];
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
  publicVisibility: boolean;
  postCount: number;
  recentPosts: CommunityPost[];
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

export function useCommunityFeed({ pageSize = 20, tag, q }: { pageSize?: number; tag?: string | null; q?: string } = {}) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const tagFilter = tag ? String(tag).trim().toLowerCase() : '';
  const qFilter = q?.trim() ?? '';
  const qParam = qFilter.length >= 2 ? qFilter : '';

  const loadPage = useCallback(async (nextOffset: number, append: boolean) => {
    const params = new URLSearchParams();
    params.set('limit', String(pageSize));
    params.set('offset', String(nextOffset));
    if (tagFilter) params.set('tag', tagFilter);
    if (qParam) params.set('q', qParam);
    const r = await fetch(api(`/api/community/feed?${params.toString()}`), {
      credentials: 'same-origin',
    });
    const data = await parseJson<{
      posts: CommunityPost[];
      pagination: { hasMore: boolean; offset: number };
    }>(r);
    setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
    setHasMore(!!data.pagination?.hasMore);
    setOffset(nextOffset + data.posts.length);
  }, [pageSize, tagFilter, qParam]);

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

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  return { posts, loading, loadingMore, error, hasMore, refresh, loadMore, prependPost, patchPost, removePost };
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

export async function createCommunityPost(input: {
  title?: string;
  body: string;
  audioExportId?: string;
  audioLabel?: string;
  pendingImage?: boolean;
}) {
  const r = await fetch(api('/api/community/posts'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseJson<CommunityPost>(r);
}

export async function uploadCommunityPostImage(postId: string, file: File) {
  const form = new FormData();
  form.append('image', file);
  const r = await fetch(api(`/api/community/posts/${encodeURIComponent(postId)}/image`), {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  return parseJson<CommunityPost>(r);
}

export async function deleteCommunityPost(postId: string) {
  const r = await fetch(api(`/api/community/posts/${encodeURIComponent(postId)}`), {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  return parseJson<{ deleted?: boolean; ok?: boolean; id?: string }>(r);
}

export async function clearCommunityPostAudio(postId: string) {
  const r = await fetch(api(`/api/community/posts/${encodeURIComponent(postId)}`), {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clearAudio: true }),
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
