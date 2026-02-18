'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';

export default function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('');
  const [post, setPost] = useState<{
    id: string; title: string; body: string; createdAt: string;
    group?: { id: string; slug: string; name: string };
    author?: { id: string; handle: string; displayName: string };
    comments?: Array<{ id: string; body: string; createdAt: string; userId: string }>;
  } | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitComment, setSubmitComment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/community/posts/${id}`);
        if (!r.ok) {
          setError(r.status === 404 ? 'Post not found' : 'Failed to load post');
          setLoading(false);
          return;
        }
        const data = await r.json();
        setPost(data);
      } catch {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !commentBody.trim()) return;
    setSubmitComment(true);
    try {
      const r = await fetch(`/api/community/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody.trim() })
      });
      if (r.ok) {
        setCommentBody('');
        const newComment = await r.json();
        setPost(prev => prev ? {
          ...prev,
          comments: [...(prev.comments || []), newComment]
        } : null);
      }
    } finally {
      setSubmitComment(false);
    }
  };

  if (loading && !post) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6 text-subtext">Loading post…</div>
      </AppShell>
    );
  }
  if (error || !post) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6">
          <p className="text-red-500">{error || 'Post not found'}</p>
          <Link href="/community" className="text-emerald-500 hover:underline mt-2 inline-block">← Back to Community</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {post.group && (
          <Link href={`/community/group/${post.group.slug || post.group.id}`} className="text-subtext hover:text-text text-sm">← Back to {post.group.name}</Link>
        )}
        {!post.group && <Link href="/community" className="text-subtext hover:text-text text-sm">← Back to Community</Link>}

        <article className="rounded-lg border border-border bg-surface-1 p-6">
          <h1 className="text-2xl font-bold text-text">{post.title}</h1>
          {post.author && (
            <p className="text-sm text-subtext mt-1">{post.author.displayName || post.author.handle}</p>
          )}
          <p className="text-sm text-subtext mt-1">{new Date(post.createdAt).toLocaleString()}</p>
          <div className="mt-4 text-text whitespace-pre-wrap">{post.body}</div>
        </article>

        <section>
          <h2 className="text-lg font-medium text-text mb-3">Comments</h2>
          {post.comments && post.comments.length > 0 && (
            <ul className="space-y-3 mb-6">
              {post.comments.map(c => (
                <li key={c.id} className="rounded-lg border border-border bg-surface-1 p-3">
                  <p className="text-sm text-text">{c.body}</p>
                  <span className="text-xs text-subtext">{new Date(c.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={onAddComment} className="space-y-2">
            <textarea
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              rows={3}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-text placeholder:text-subtext text-sm"
              maxLength={5000}
            />
            <button
              type="submit"
              disabled={!commentBody.trim() || submitComment}
              className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium disabled:opacity-50"
            >
              {submitComment ? 'Posting…' : 'Add comment'}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
