'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import type { CommunityComment } from '@/core/social/community-posts-hooks';
import { createCommunityComment } from '@/core/social/community-posts-hooks';
import { formatCommunityTimestamp } from '@/lib/community-timestamp';
import { formatCommunityAuthorLabel } from '@/lib/community-author-display';

interface CommunityCommentThreadProps {
  postId: string;
  comments: CommunityComment[];
  onCommentAdded?: (comment: CommunityComment) => void;
}

export function CommunityCommentThread({ postId, comments, onCommentAdded }: CommunityCommentThreadProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);

  useEffect(() => {
    if (!moderationError) return;
    const timer = window.setTimeout(() => setModerationError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [moderationError]);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    setModerationError(null);
    try {
      const comment = await createCommunityComment(postId, trimmed);
      setBody('');
      onCommentAdded?.(comment);
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'content_moderation_failed') {
        setModerationError(
          "Your comment couldn't be published because it contains content that violates our community guidelines."
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to post comment');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4" aria-label="Comments">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Comments</h3>
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id}>
            <Card elevation="flat" size="sm" className="space-y-1">
              <p className="text-xs text-text-secondary">{formatCommunityAuthorLabel(c.author)}</p>
              <p className="text-body-sm text-text-primary whitespace-pre-wrap">{c.body}</p>
              <p className="text-xs text-text-secondary">
                <time dateTime={c.createdAt}>{formatCommunityTimestamp(c.createdAt)}</time>
              </p>
            </Card>
          </li>
        ))}
        {comments.length === 0 ? (
          <li className="text-sm text-text-secondary">No comments yet.</li>
        ) : null}
      </ul>
      <div className="space-y-2">
        {moderationError ? (
          <p className="text-sm text-red-400" role="alert">
            {moderationError}
          </p>
        ) : null}
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            if (moderationError) setModerationError(null);
          }}
          placeholder="Write a comment… Use @handle to mention someone."
          rows={3}
          className="w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm text-text-primary"
        />
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <Button type="button" size="sm" disabled={submitting || !body.trim()} onClick={() => void submit()}>
          {submitting ? 'Posting…' : 'Post comment'}
        </Button>
      </div>
    </section>
  );
}
