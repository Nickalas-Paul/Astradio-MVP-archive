'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CommunityPostCard } from '@/components/community/posts/CommunityPostCard';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { useCommunityFeed, createCommunityPost } from '@/core/social/community-posts-hooks';
import { getApiBaseUrl } from '@/core/api-base';
import { isFeatureEnabled } from '@/core/config/flags';
import { useState } from 'react';

export function CommunityFeed() {
  const enabled = isFeatureEnabled('ENABLE_COMMUNITY_POSTS');
  const { posts, loading, loadingMore, error, hasMore, loadMore, refresh, patchPost, prependPost } =
    useCommunityFeed();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const onLikeChange = useCallback(
    (postId: string, patch: Parameters<typeof patchPost>[1]) => patchPost(postId, patch),
    [patchPost]
  );

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loadMore, loading, loadingMore]);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;
    const es = new EventSource(`${getApiBaseUrl() || ''}/api/community/events/stream`);
    const onFeed = () => void refresh();
    es.addEventListener('feed', onFeed);
    return () => {
      es.removeEventListener('feed', onFeed);
      es.close();
    };
  }, [enabled, refresh]);

  useEffect(() => {
    if (!moderationError) return;
    const timer = window.setTimeout(() => setModerationError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [moderationError]);

  const submitPost = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    setModerationError(null);
    try {
      const post = await createCommunityPost({ body });
      prependPost(post);
      setDraft('');
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'content_moderation_failed') {
        setModerationError(
          "Your post couldn't be published because it contains content that violates our community guidelines."
        );
      }
    } finally {
      setPosting(false);
    }
  };

  if (!enabled) {
    return (
      <Card elevation="resting" className="text-sm text-text-secondary">
        Community posts are not enabled for your account yet.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card elevation="resting" className="space-y-3">
        <h2 className="text-h3 font-serif text-text-primary">Share with the community</h2>
        {moderationError ? (
          <p className="text-sm text-red-400" role="alert">
            {moderationError}
          </p>
        ) : null}
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (moderationError) setModerationError(null);
          }}
          rows={3}
          placeholder="What's on your mind?"
          className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary"
        />
        <Button type="button" size="sm" disabled={posting || !draft.trim()} onClick={() => void submitPost()}>
          {posting ? 'Posting…' : 'Post'}
        </Button>
      </Card>

      {loading ? <p className="text-sm text-text-secondary">Loading feed…</p> : null}
      {error ? (
        <Card elevation="flat" className="text-sm text-red-400 space-y-2">
          <p>{error}</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => void refresh()}>
            Retry
          </Button>
        </Card>
      ) : null}

      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            <CommunityPostCard post={post} onLikeChange={onLikeChange} />
          </li>
        ))}
      </ul>

      {posts.length === 0 && !loading ? (
        <p className="text-sm text-text-secondary text-center">No posts yet. Be the first to share.</p>
      ) : null}

      <div ref={sentinelRef} className="h-4" aria-hidden />
      {loadingMore ? <p className="text-xs text-text-secondary text-center">Loading more…</p> : null}
    </div>
  );
}
