'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import type { CommunityPost } from '@/core/social/community-posts-hooks';
import { deleteCommunityPost, likeCommunityPost, unlikeCommunityPost } from '@/core/social/community-posts-hooks';
import { formatCommunityTimestamp } from '@/lib/community-timestamp';
import { communityAuthorInitial } from '@/lib/community-author-display';
import { CommunityPostAudioSection } from '@/components/community/posts/CommunityPostAudioSection';
import { HashtagText } from '@/components/community/posts/HashtagText';
import { ReportModal } from '@/components/shared/ReportModal';
import {
  ChatBubbleIcon,
  HeartIcon,
  OverflowMenuIcon,
  ShareIcon,
} from '@/components/community/posts/community-post-icons';

interface CommunityPostCardProps {
  post: CommunityPost;
  currentUserId?: string | null;
  onLikeChange?: (postId: string, patch: Partial<CommunityPost>) => void;
  onDelete?: (postId: string) => void;
  onRestore?: (post: CommunityPost) => void;
  onPostChange?: (postId: string, patch: Partial<CommunityPost>) => void;
  onTagClick?: (tag: string) => void;
  compact?: boolean;
}

function AuthorHeader({
  post,
  currentUserId,
  onDeleteRequest,
  onReportRequest,
  reported,
}: {
  post: CommunityPost;
  currentUserId?: string | null;
  onDeleteRequest: () => void;
  onReportRequest: () => void;
  reported: boolean;
}) {
  const displayName = post.author?.displayName?.trim() || '';
  const handle = post.author?.handle?.trim().replace(/^@/, '') || '';
  const initial = communityAuthorInitial(post.author);
  const avatarUrl = post.author?.avatarUrl;
  const isOwner = Boolean(currentUserId && post.userId === currentUserId);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  return (
    <div className="flex items-start gap-3 min-w-0">
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
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm min-w-0">
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
          {isOwner ? (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                aria-label="Post options"
                aria-expanded={menuOpen}
              >
                <OverflowMenuIcon />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-border bg-surface-1 shadow-lg py-1">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-surface-2"
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteRequest();
                    }}
                  >
                    Delete post
                  </button>
                </div>
              ) : null}
            </div>
          ) : currentUserId ? (
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                aria-label="Post options"
                aria-expanded={menuOpen}
              >
                <OverflowMenuIcon />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-border bg-surface-1 shadow-lg py-1">
                  {reported ? (
                    <p className="px-3 py-2 text-xs text-text-muted">Reported</p>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                      onClick={() => {
                        setMenuOpen(false);
                        onReportRequest();
                      }}
                    >
                      Report
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CommunityPostCard({
  post,
  currentUserId,
  onLikeChange,
  onDelete,
  onRestore,
  onPostChange,
  onTagClick,
  compact = false,
}: CommunityPostCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const shareCopiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
    };
  }, []);

  const sharePost = async () => {
    const permalink = `${window.location.origin}/community/post/${post.id}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: 'Astradio Community', url: permalink });
        return;
      }
      await navigator.clipboard.writeText(permalink);
      setShareCopied(true);
      if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
      shareCopiedTimerRef.current = setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // User cancelled share sheet or clipboard denied
    }
  };

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

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    onDelete?.(post.id);
    try {
      await deleteCommunityPost(post.id);
      setConfirmOpen(false);
    } catch (e) {
      onRestore?.(post);
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete post');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card elevation="resting" size={compact ? 'sm' : 'md'} className="space-y-4">
      <AuthorHeader
        post={post}
        currentUserId={currentUserId}
        onDeleteRequest={() => setConfirmOpen(true)}
        onReportRequest={() => setReportOpen(true)}
        reported={reported}
      />

      {confirmOpen ? (
        <div className="rounded-lg border border-border bg-surface-0 p-4 space-y-3">
          <p className="text-sm text-text-primary">Delete this post? This cannot be undone.</p>
          {deleteError ? <p className="text-xs text-red-400">{deleteError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={deleting} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600 text-white border-red-500"
              onClick={() => void confirmDelete()}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {post.title ? (
          <Link href={`/community/post/${post.id}`} className="text-h3 font-serif text-text-primary hover:text-accent block">
            {post.title}
          </Link>
        ) : null}
        {post.body ? (
          <p className="text-body-sm text-text-primary whitespace-pre-wrap leading-relaxed">
            {onTagClick ? <HashtagText text={post.body} onTagClick={onTagClick} /> : post.body}
          </p>
        ) : null}

        {post.hashtags && post.hashtags.length > 0 && onTagClick ? (
          <div className="flex flex-wrap gap-1.5">
            {post.hashtags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="text-xs text-accent hover:underline"
              >
                #{tag}
              </button>
            ))}
          </div>
        ) : null}

        {post.imageUrl ? (
          <div className="w-full rounded-lg overflow-hidden bg-black/20 border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.imageUrl}
              alt=""
              className="w-full max-h-[500px] object-contain"
            />
          </div>
        ) : null}

        {post.audioExportId ? (
          <CommunityPostAudioSection
            postId={post.id}
            exportId={post.audioExportId}
            audioLabel={post.audioLabel}
            currentUserId={currentUserId}
            postUserId={post.userId}
            onAudioCleared={() => {
              onPostChange?.(post.id, { audioExportId: null, audioLabel: null });
            }}
          />
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
        <button
          type="button"
          onClick={() => void sharePost()}
          className="inline-flex items-center gap-1.5 hover:text-accent transition-colors cursor-pointer"
          aria-label="Share post"
        >
          <ShareIcon />
          {shareCopied ? <span className="text-xs text-accent">Link copied</span> : null}
        </button>
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        onReported={() => setReported(true)}
      />
    </Card>
  );
}
