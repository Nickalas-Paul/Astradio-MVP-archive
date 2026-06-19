import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createComment,
  createPost,
  deletePost,
  fetchFeed,
  fetchTrendingTags,
  likePost,
  unlikePost,
  uploadPostImage,
} from '../lib/community-feed-fetch';
import { formatApiError } from '../lib/format-api-error';
import { useAuthStore } from '../store/auth';
import type { CommunityPost, TrendingTag } from '../types/community-feed';

const PAGE_SIZE = 20;

export function useCommunityFeed(enabled: boolean) {
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadedRef = useRef(false);

  const loadPage = useCallback(
    async (offset: number, append: boolean) => {
      if (!authUserId) {
        setPosts([]);
        setHasMore(false);
        return;
      }

      const data = await fetchFeed(offset, PAGE_SIZE, authUserId);
      setPosts((prev) => (append ? [...prev, ...data.posts] : data.posts));
      setHasMore(data.pagination.hasMore);
      offsetRef.current = offset + data.posts.length;
    },
    [authUserId]
  );

  const refresh = useCallback(async () => {
    if (!enabled || !authUserId) return;
    setLoading(true);
    setError(null);
    offsetRef.current = 0;
    try {
      const [_, tags] = await Promise.all([
        loadPage(0, false),
        fetchTrendingTags(8),
      ]);
      setTrendingTags(tags);
      loadedRef.current = true;
    } catch (err) {
      setError(formatApiError(err, 'Could not load feed'));
    } finally {
      setLoading(false);
    }
  }, [authUserId, enabled, loadPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || !authUserId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      await loadPage(offsetRef.current, true);
    } catch (err) {
      setError(formatApiError(err, 'Could not load more posts'));
    } finally {
      setLoadingMore(false);
    }
  }, [authUserId, enabled, hasMore, loadPage, loadingMore]);

  useEffect(() => {
    if (!enabled) return;
    if (loadedRef.current) return;
    void refresh();
  }, [enabled, refresh]);

  const incrementCommentCount = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p
      )
    );
  }, []);

  const submitPost = useCallback(
    async (
      body: string,
      title?: string,
      imageUri?: string | null,
      imageMimeType?: string | null
    ): Promise<{ moderationWarning?: string }> => {
      if (!authUserId) throw { status: 401, error: 'not_authenticated' };

      const trimmedBody = body.trim();
      const trimmedTitle = title?.trim() ?? '';
      const hasImage = Boolean(imageUri?.trim());
      if (!trimmedBody && !trimmedTitle && !hasImage) {
        throw { status: 400, error: 'content_required' };
      }

      let post = await createPost({
        body: trimmedBody,
        title: trimmedTitle || undefined,
        userId: authUserId,
        pendingImage: hasImage && !trimmedBody && !trimmedTitle,
      });

      let moderationWarning: string | undefined;

      if (hasImage && imageUri) {
        try {
          post = await uploadPostImage(
            post.id,
            imageUri,
            imageMimeType || 'image/jpeg',
            authUserId
          );
        } catch (err) {
          const code =
            err && typeof err === 'object' && 'error' in err
              ? String((err as { error?: string }).error)
              : '';
          const message =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: string }).message)
              : '';

          if (code === 'content_moderation_failed') {
            moderationWarning =
              message ||
              'Your post was published without the image. The image violates our community guidelines.';
          } else if (!trimmedBody && !trimmedTitle) {
            await deletePost(post.id, authUserId).catch(() => {});
            throw err;
          } else {
            moderationWarning = formatApiError(err, 'Post published, but the image failed to upload.');
          }
        }
      }

      setPosts((prev) => [post, ...prev.filter((p) => p.id !== post.id)]);
      return { moderationWarning };
    },
    [authUserId]
  );

  const toggleLike = useCallback(
    async (postId: string) => {
      if (!authUserId) return;

      const target = posts.find((p) => p.id === postId);
      if (!target) return;

      const wasLiked = !!target.likedByViewer;
      const priorLikeId = target.viewerLikeId ?? null;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByViewer: !wasLiked,
                viewerLikeId: wasLiked ? null : p.viewerLikeId ?? 'pending',
                likeCount: Math.max(0, (p.likeCount ?? 0) + (wasLiked ? -1 : 1)),
              }
            : p
        )
      );

      try {
        if (wasLiked && priorLikeId) {
          await unlikePost(priorLikeId, authUserId);
        } else {
          const like = await likePost(postId, authUserId);
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, likedByViewer: true, viewerLikeId: like.id } : p
            )
          );
        }
      } catch {
        setPosts((prev) => prev.map((p) => (p.id === postId ? target : p)));
      }
    },
    [authUserId, posts]
  );

  const removePost = useCallback(
    async (postId: string) => {
      if (!authUserId) return;
      const snapshot = posts.find((p) => p.id === postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      try {
        await deletePost(postId, authUserId);
      } catch (err) {
        if (snapshot) {
          setPosts((prev) => [snapshot, ...prev]);
        }
        throw err;
      }
    },
    [authUserId, posts]
  );

  const patchPost = useCallback((postId: string, patch: Partial<CommunityPost>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  return {
    posts,
    trendingTags,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    submitPost,
    toggleLike,
    removePost,
    patchPost,
    incrementCommentCount,
  };
}
