'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CommunityPostCard } from '@/components/community/posts/CommunityPostCard';
import { CommunityCommentThread } from '@/components/community/posts/CommunityCommentThread';
import { useCommunityPost } from '@/core/social/community-posts-hooks';
import { useProfile } from '@/core/social/hooks';

export default function CommunityPostPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { user } = useProfile();
  const { post, loading, error, refresh, setPost } = useCommunityPost(id || null);

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
              currentUserId={user?.id ?? null}
              onLikeChange={(postId, patch) => {
                setPost((prev) => (prev ? { ...prev, ...patch } : prev));
              }}
              onPostChange={(postId, patch) => {
                setPost((prev) => (prev ? { ...prev, ...patch } : prev));
              }}
              onDelete={() => router.push('/community?tab=feed')}
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
