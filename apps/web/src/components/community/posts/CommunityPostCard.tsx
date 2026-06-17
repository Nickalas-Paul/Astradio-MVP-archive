'use client';

import Link from 'next/link';
import { Card } from '@/components/shared/Card';
import type { CommunityPost } from '@/core/social/community-posts-hooks';
import { likeCommunityPost, unlikeCommunityPost } from '@/core/social/community-posts-hooks';
import { formatCommunityTimestamp } from '@/lib/community-timestamp';
import { formatCommunityAuthorLabel } from '@/lib/community-author-display';

interface CommunityPostCardProps {
  post: CommunityPost;
  onLikeChange?: (postId: string, patch: Partial<CommunityPost>) => void;
  compact?: boolean;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      className={filled ? 'text-accent' : 'text-current'}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      className="text-current"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AuthorLink({ post }: { post: CommunityPost }) {
  const displayName = post.author?.displayName?.trim() || '';
  const handle = post.author?.handle?.trim().replace(/^@/, '') || '';
  const label = formatCommunityAuthorLabel(post.author);

  return (
    <Link href={`/community/profile/${post.userId}`} className="hover:text-accent transition-colors">
      {displayName ? (
        <>
          <span className="font-semibold text-text-primary">{displayName}</span>
          {handle ? <span className="text-text-secondary"> @{handle}</span> : null}
        </>
      ) : (
        label
      )}
    </Link>
  );
}

export function CommunityPostCard({ post, onLikeChange, compact = false }: CommunityPostCardProps) {
  const toggleLike = async () => {
    const prevLiked = !!post.likedByViewer;
    const prevLikeId = post.viewerLikeId ?? null;
    const prevCount = post.likeCount ?? 0;

    if (prevLiked && prevLikeId) {
      onLikeChange?.(post.id, {
        likedByViewer: false,
        viewerLikeId: null,
        likeCount: Math.max(0, prevCount - 1),
      });
      try {
        await unlikeCommunityPost(prevLikeId);
      } catch {
        onLikeChange?.(post.id, {
          likedByViewer: true,
          viewerLikeId: prevLikeId,
          likeCount: prevCount,
        });
      }
      return;
    }

    onLikeChange?.(post.id, {
      likedByViewer: true,
      viewerLikeId: post.viewerLikeId ?? 'pending',
      likeCount: prevCount + 1,
    });
    try {
      const like = await likeCommunityPost(post.id);
      onLikeChange?.(post.id, {
        likedByViewer: true,
        viewerLikeId: like.id,
        likeCount: prevCount + 1,
      });
    } catch {
      onLikeChange?.(post.id, {
        likedByViewer: false,
        viewerLikeId: null,
        likeCount: prevCount,
      });
    }
  };

  return (
    <Card elevation="resting" size={compact ? 'sm' : 'md'} className="space-y-3">
      <div className="space-y-1">
        {post.title ? (
          <Link href={`/community/post/${post.id}`} className="text-h3 font-serif text-text-primary hover:text-accent">
            {post.title}
          </Link>
        ) : null}
        <p className="text-body-sm text-text-primary whitespace-pre-wrap leading-relaxed">{post.body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
        <AuthorLink post={post} />
        <time dateTime={post.createdAt}>{formatCommunityTimestamp(post.createdAt)}</time>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
        <button
          type="button"
          onClick={() => void toggleLike()}
          className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
          aria-pressed={!!post.likedByViewer}
          aria-label={post.likedByViewer ? 'Unlike post' : 'Like post'}
        >
          <HeartIcon filled={!!post.likedByViewer} />
          <span>{post.likeCount ?? 0}</span>
        </button>
        <Link
          href={`/community/post/${post.id}`}
          className="inline-flex items-center gap-1.5 hover:text-accent transition-colors"
        >
          <ChatBubbleIcon />
          <span>{post.commentCount ?? 0}</span>
        </Link>
      </div>
    </Card>
  );
}
