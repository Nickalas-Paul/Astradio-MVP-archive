'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { MemberCard } from '@/components/compatibility/MemberCard';
import { useProfile } from '@/core/social/hooks';

const GUIDANCE_BANNER = 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.';

export default function CommunityGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [group, setGroup] = useState<{ id: string; slug: string; name: string; description: string; tags: string[]; memberCount: number } | null>(null);
  const [profile, setProfile] = useState<{ explanation?: { sections: Array<{ title: string; text: string }> }; memberCount?: number } | null>(null);
  const [posts, setPosts] = useState<Array<{ id: string; title: string; body: string; createdAt: string }>>([]);
  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState<Array<{ userId: string; chartId?: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { primaryChart } = useProfile();

  useEffect(() => {
    params.then(p => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const gRes = await fetch(`/api/community/groups/${encodeURIComponent(slug)}`);
        if (!gRes.ok) {
          setError(gRes.status === 404 ? 'Group not found' : 'Failed to load group');
          setLoading(false);
          return;
        }
        const g = await gRes.json();
        setGroup(g);

        const postsRes = await fetch(`/api/community/groups/${g.id}/posts`);
        if (postsRes.ok) {
          const { posts: p } = await postsRes.json();
          setPosts(p || []);
        }
        const membersRes = await fetch(`/api/community/groups/${g.id}/members`);
        if (membersRes.ok) {
          const { members: m } = await membersRes.json();
          setMembers(m || []);
        }

        try {
          const profileRes = await fetch(`/api/community/groups/${g.id}/profile`, { method: 'POST' });
          if (profileRes.ok) {
            const pr = await profileRes.json();
            setProfile(pr);
          }
        } catch {
          // no member charts
        }
      } catch (e) {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const onJoin = async () => {
    if (!group) return;
    setJoinLoading(true);
    try {
      const r = await fetch(`/api/community/groups/${group.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (r.ok) setJoined(true);
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading && !group) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6 text-subtext">Loading group…</div>
      </AppShell>
    );
  }
  if (error || !group) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6">
          <p className="text-red-500">{error || 'Group not found'}</p>
          <Link href="/community" className="text-emerald-500 hover:underline mt-2 inline-block">← Back to Community</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link href="/community" className="text-subtext hover:text-text text-sm">← Back to Community</Link>

        <div className="rounded-lg border border-amber-200/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          {GUIDANCE_BANNER}
        </div>

        <header>
          <h1 className="text-2xl font-bold text-text">{group.name}</h1>
          <p className="text-subtext mt-1">{group.description}</p>
          {group.tags && group.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {group.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded bg-surface-2 text-xs text-subtext">{t}</span>
              ))}
            </div>
          )}
          <p className="text-sm text-subtext mt-2">{group.memberCount ?? 0} members</p>
        </header>

        {profile && (
          <section className="rounded-lg border border-border bg-surface-1 p-4">
            <h2 className="text-lg font-medium text-text mb-2">Group profile</h2>
            {profile.explanation?.sections?.map((s, i) => (
              <div key={i} className="mb-2">
                <h3 className="text-sm font-medium text-subtext">{s.title}</h3>
                <p className="text-sm text-text">{s.text}</p>
              </div>
            ))}
            {!profile.explanation?.sections?.length && (
              <p className="text-sm text-subtext">No aggregate profile (add member charts when joining to compute).</p>
            )}
          </section>
        )}

        <div className="flex gap-2">
          <button
            onClick={onJoin}
            disabled={joined || joinLoading}
            className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium disabled:opacity-50"
          >
            {joined ? 'Joined' : joinLoading ? 'Joining…' : 'Join group'}
          </button>
          <Link
            href={`/compatibility/intent?groupId=${group.id}`}
            className="px-4 py-2 rounded-lg border border-border bg-surface-2 text-sm font-medium hover:bg-surface-3"
          >
            Compatibility in this group
          </Link>
        </div>

        {members.length > 0 && (
          <section>
            <h2 className="text-lg font-medium text-text mb-3">Members</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <MemberCard
                  key={m.userId}
                  member={{
                    userId: m.userId,
                    chartId: m.chartId || '',
                    displayName: m.displayName,
                    descriptors: [],
                  }}
                  seekerChartId={primaryChart?.id ?? 'chart_profile_default'}
                  band=""
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-medium text-text mb-3">Posts</h2>
          {posts.length === 0 ? (
            <p className="text-subtext text-sm">No posts yet.</p>
          ) : (
            <ul className="space-y-3">
              {posts.map(p => (
                <li key={p.id}>
                  <Link href={`/community/post/${p.id}`} className="block rounded-lg border border-border bg-surface-1 p-4 hover:bg-surface-2">
                    <h3 className="font-medium text-text">{p.title}</h3>
                    <p className="text-sm text-subtext line-clamp-2 mt-1">{p.body}</p>
                    <span className="text-xs text-subtext mt-2 block">{new Date(p.createdAt).toLocaleDateString()}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
