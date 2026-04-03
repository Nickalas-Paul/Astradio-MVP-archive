'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { MemberCard } from '@/components/compatibility/MemberCard';
import { useProfile } from '@/core/social/hooks';
import { hasRealChart } from '@/core/social/constants';

const GUIDANCE_BANNER = 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.';

export default function CommunityGroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug] = useState<string>('');
  const [group, setGroup] = useState<{
    id: string;
    slug: string;
    name: string;
    description: string;
    memberCount?: number;
  } | null>(null);
  const [profile, setProfile] = useState<{ explanation?: { sections: Array<{ title: string; text: string }> } } | null>(null);
  const [members, setMembers] = useState<Array<{ userId: string; chartId?: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, primaryChart } = useProfile();
  const seekerChartId = hasRealChart(primaryChart) ? primaryChart.id : null;

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const gRes = await fetch(`/api/community/relational-group/${encodeURIComponent(slug)}`, {
          credentials: 'same-origin',
        });
        if (!gRes.ok) {
          setError(
            gRes.status === 404
              ? 'Group not found'
              : gRes.status === 401
                ? 'Sign in to view this group'
                : 'Failed to load group'
          );
          setLoading(false);
          return;
        }
        const g = await gRes.json();
        setGroup(g);

        let roster: Array<{ userId: string; chartId?: string; displayName: string }> = [];
        const membersRes = await fetch(`/api/community/relational-group/${encodeURIComponent(g.id)}/members`, {
          credentials: 'same-origin',
        });
        if (membersRes.ok) {
          const body = await membersRes.json();
          roster = body.members || [];
          setMembers(roster);
        }

        const chartIds = roster
          .map((x) => x.chartId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0);
        if (chartIds.length > 0) {
          const profileRes = await fetch('/api/community/groups/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ groupId: g.id, chartIds }),
          });
          if (profileRes.ok) {
            const pr = await profileRes.json();
            setProfile(pr);
          }
        }
      } catch {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, user?.id]);

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
          <Link href="/community" className="text-emerald-500 hover:underline mt-2 inline-block">
            ← Back to Community
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link href="/community" className="text-subtext hover:text-text text-sm">
          ← Back to Community
        </Link>

        <div className="rounded-lg border border-amber-200/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          {GUIDANCE_BANNER}
        </div>

        <header>
          <h1 className="text-2xl font-bold text-text">{group.name}</h1>
          <p className="text-subtext mt-1">{group.description}</p>
          <p className="text-sm text-subtext mt-2">{group.memberCount ?? members.length} members</p>
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
              <p className="text-sm text-subtext">No aggregate profile (add member charts to compute).</p>
            )}
          </section>
        )}

        <Link
          href={`/compatibility/intent?groupId=${group.id}`}
          className="inline-block px-4 py-2 rounded-lg border border-border bg-surface-2 text-sm font-medium hover:bg-surface-3"
        >
          Compatibility in this group
        </Link>

        {members.length > 0 && (
          <section>
            <h2 className="text-lg font-medium text-text mb-3">Members</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((m) => (
                <MemberCard
                  key={`${m.userId}-${m.chartId || ''}`}
                  member={{
                    userId: m.userId,
                    chartId: m.chartId || '',
                    displayName: m.displayName,
                    descriptors: [],
                  }}
                  seekerChartId={seekerChartId}
                  band=""
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
