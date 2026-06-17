'use client';

import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { CommunityPostCard } from '@/components/community/posts/CommunityPostCard';
import { CommunityCommentThread } from '@/components/community/posts/CommunityCommentThread';
import { useCommunityPost } from '@/core/social/community-posts-hooks';
import { use } from 'react';

export default function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { post, loading, error, refresh, setPost } = useCommunityPost(id);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link href="/community?tab=feed" className="text-sm text-accent hover:underline inline-block">
          ← Back to feed
        </Link>
        {loading ? <p className="text-sm text-text-secondary">Loading post…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {post ? (
          <>
            <CommunityPostCard
              post={post}
              onLikeChange={(postId, patch) => {
                setPost((prev) => (prev ? { ...prev, ...patch } : prev));
              }}
            />
            <CommunityCommentThread
              postId={post.id}
              comments={post.comments || []}
              onCommentAdded={(comment) => {
                setPost((prev) =>
                  prev
                    ? {
                        ...prev,
                        comments: [...(prev.comments || []), comment],
                        commentCount: (prev.commentCount || 0) + 1,
                      }
                    : prev
                );
              }}
            />
          </>
        ) : null}
        {!loading && !post && !error ? (
          <button type="button" className="text-sm text-accent" onClick={() => void refresh()}>
            Retry
          </button>
        ) : null}
      </div>
    </AppShell>
  );
}
