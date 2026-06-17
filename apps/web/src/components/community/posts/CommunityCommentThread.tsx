'use client';

import { useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import type { CommunityComment } from '@/core/social/community-posts-hooks';
import { createCommunityComment } from '@/core/social/community-posts-hooks';

interface CommunityCommentThreadProps {
  postId: string;
  comments: CommunityComment[];
  onCommentAdded?: (comment: CommunityComment) => void;
}

export function CommunityCommentThread({ postId, comments, onCommentAdded }: CommunityCommentThreadProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const comment = await createCommunityComment(postId, trimmed);
      setBody('');
      onCommentAdded?.(comment);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post comment');
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
              <p className="text-body-sm text-text-primary whitespace-pre-wrap">{c.body}</p>
              <p className="text-xs text-text-secondary">
                <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleString()}</time>
              </p>
            </Card>
          </li>
        ))}
        {comments.length === 0 ? (
          <li className="text-sm text-text-secondary">No comments yet.</li>
        ) : null}
      </ul>
      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
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
