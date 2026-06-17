'use client';

import Link from 'next/link';
import { Card } from '@/components/shared/Card';
import type { CommunityPost } from '@/core/social/community-posts-hooks';
import { likeCommunityPost, unlikeCommunityPost } from '@/core/social/community-posts-hooks';
import { formatCommunityTimestamp } from '@/lib/community-timestamp';
import { communityAuthorInitial } from '@/lib/community-author-display';
import { ValidatedExportAudioPlayer } from '@/components/community/ValidatedExportAudioPlayer';
import { ChatBubbleIcon, HeartIcon, ShareIcon } from '@/components/community/posts/community-post-icons';

interface CommunityPostCardProps {
  post: CommunityPost;
  onLikeChange?: (postId: string, patch: Partial<CommunityPost>) => void;
  compact?: boolean;
}

function AuthorHeader({ post }: { post: CommunityPost }) {
  const displayName = post.author?.displayName?.trim() || '';
  const handle = post.author?.handle?.trim().replace(/^@/, '') || '';
  const initial = communityAuthorInitial(post.author);
  const avatarUrl = post.author?.avatarUrl;

  return (
    <div className="flex items-center gap-3 min-w-0">
      <Link href={`/community/profile/${post.userId}`} className="shrink-0">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-border"
          />
        ) : (
          <span
            className="w-10 h-10 rounded-full border border-border bg-surface-2 flex items-center justify-center font-serif text-sm text-text-primary"
            aria-hidden
          >
            {initial}
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <Link href={`/community/profile/${post.userId}`} className="hover:text-accent transition-colors min-w-0">
            {displayName ? (
              <span className="font-semibold text-text-primary">{displayName}</span>
            ) : handle ? (
              <span className="font-semibold text-text-primary">@{handle}</span>
            ) : (
              <span className="font-semibold text-text-primary">Anonymous</span>
            )}
            {displayName && handle ? (
              <span className="text-text-secondary font-normal"> @{handle}</span>
            ) : null}
          </Link>
          <time dateTime={post.createdAt} className="text-xs text-text-secondary shrink-0">
            {formatCommunityTimestamp(post.createdAt)}
          </time>
        </div>
      </div>
    </div>
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
    <Card elevation="resting" size={compact ? 'sm' : 'md'} className="space-y-4">
      <AuthorHeader post={post} />

      <div className="space-y-3">
        {post.title ? (
          <Link href={`/community/post/${post.id}`} className="text-h3 font-serif text-text-primary hover:text-accent block">
            {post.title}
          </Link>
        ) : null}
        {post.body ? (
          <p className="text-body-sm text-text-primary whitespace-pre-wrap leading-relaxed">{post.body}</p>
        ) : null}

        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt=""
            className="w-full rounded-lg max-h-[400px] object-cover border border-border"
          />
        ) : null}

        {post.audioExportId ? (
          <div className="rounded-lg border border-border bg-surface-0/50 p-3">
            {post.audioLabel ? (
              <p className="text-xs text-text-secondary mb-2 truncate">{post.audioLabel}</p>
            ) : null}
            <ValidatedExportAudioPlayer exportId={post.audioExportId} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary pt-1 border-t border-border/60">
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
        <span
          className="inline-flex items-center gap-1.5 text-text-secondary/60 cursor-default"
          aria-label="Share (coming soon)"
          title="Share coming soon"
        >
          <ShareIcon />
        </span>
      </div>
    </Card>
  );
}
