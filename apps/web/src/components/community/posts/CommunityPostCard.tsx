'use client';

import Link from 'next/link';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import type { CommunityPost } from '@/core/social/community-posts-hooks';
import { likeCommunityPost, unlikeCommunityPost } from '@/core/social/community-posts-hooks';

interface CommunityPostCardProps {
  post: CommunityPost;
  onLikeChange?: (postId: string, patch: Partial<CommunityPost>) => void;
  compact?: boolean;
}

export function CommunityPostCard({ post, onLikeChange, compact = false }: CommunityPostCardProps) {
  const toggleLike = async () => {
    try {
      if (post.likedByViewer && post.viewerLikeId) {
        await unlikeCommunityPost(post.viewerLikeId);
        onLikeChange?.(post.id, {
          likedByViewer: false,
          viewerLikeId: null,
          likeCount: Math.max(0, (post.likeCount || 0) - 1),
        });
      } else {
        const like = await likeCommunityPost(post.id);
        onLikeChange?.(post.id, {
          likedByViewer: true,
          viewerLikeId: like.id,
          likeCount: (post.likeCount || 0) + 1,
        });
      }
    } catch {
      // silent — user can retry
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
        <p className="text-body-sm text-text-primary whitespace-pre-wrap">{post.body}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
        <Link href={`/community/profile/${post.userId}`} className="hover:text-accent">
          Author
        </Link>
        <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString()}</time>
        <Button type="button" variant={post.likedByViewer ? 'primary' : 'ghost'} size="sm" onClick={() => void toggleLike()}>
          {post.likedByViewer ? 'Liked' : 'Like'} ({post.likeCount ?? 0})
        </Button>
        <Link href={`/community/post/${post.id}`} className="hover:text-accent">
          {post.commentCount ?? 0} comments
        </Link>
      </div>
    </Card>
  );
}
