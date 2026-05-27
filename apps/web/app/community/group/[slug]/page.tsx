'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { MemberCard } from '@/components/compatibility/MemberCard';
import { useProfile } from '@/core/social/hooks';
import { hasRealChart } from '@/core/social/constants';
import { ValidatedExportAudioPlayer } from '@/components/community/ValidatedExportAudioPlayer';

const GUIDANCE_BANNER = 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.';

function textFromReadingSnapshot(snapshot: unknown): string {
  if (snapshot == null) return '';
  if (typeof snapshot === 'string') return snapshot;
  if (typeof snapshot === 'object' && snapshot !== null && 'text' in snapshot) {
    const t = (snapshot as { text?: unknown }).text;
    return typeof t === 'string' ? t : '';
  }
  return '';
}

function groupArtifactLabel(artifactStatus: string, hasExportRef: boolean) {
  if (artifactStatus === 'not_generated') return 'Reading not generated';
  if (hasExportRef) return 'Reading available · sound record on file';
  if (artifactStatus === 'text_available') return 'Reading available';
  return 'Reading available';
}

export default function CommunityGroupPage({ params }: { params: { slug: string } }) {
  const slug = typeof params?.slug === 'string' ? decodeURIComponent(params.slug) : '';
  const [group, setGroup] = useState<{
    id: string;
    ownerId: string;
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

  const [stored, setStored] = useState<{
    readingSnapshot: unknown;
    exportJobId: string | null;
    artifactStatus: string;
  } | null>(null);
  const [storedLoading, setStoredLoading] = useState(true);
  const ownerCompositeOnceRef = useRef(false);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('Invalid group');
      return;
    }
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
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, user?.id]);

  useEffect(() => {
    if (!group?.id) return;
    let cancelled = false;
    (async () => {
      setStoredLoading(true);
      const r = await fetch(`/api/community/relational-group/${encodeURIComponent(group.id)}/stored-artifact`, {
        credentials: 'same-origin',
      });
      if (cancelled) return;
      if (r.ok) {
        const j = (await r.json()) as {
          readingSnapshot?: unknown;
          exportJobId?: string | null;
          artifactStatus?: string;
        };
        setStored({
          readingSnapshot: j.readingSnapshot ?? null,
          exportJobId: typeof j.exportJobId === 'string' && j.exportJobId.trim() ? j.exportJobId.trim() : null,
          artifactStatus: String(j.artifactStatus || 'not_generated'),
        });
      } else {
        setStored(null);
      }
      if (!cancelled) setStoredLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [group?.id]);

  useEffect(() => {
    if (!group || !user?.id) return;
    if (user.id !== group.ownerId) return;
    if (storedLoading) return;
    const readingText = textFromReadingSnapshot(stored?.readingSnapshot);
    if (readingText) return;
    if (ownerCompositeOnceRef.current) return;
    ownerCompositeOnceRef.current = true;
    void (async () => {
      const r = await fetch(`/api/groups/${encodeURIComponent(group.id)}/composite`, {
        credentials: 'same-origin',
      });
      if (!r.ok) return;
      const j = (await r.json().catch(() => ({}))) as { artifact?: { readingSnapshot?: unknown; exportJobId?: string } };
      const art = j.artifact;
      if (!art) return;
      setStored({
        readingSnapshot: art.readingSnapshot ?? null,
        exportJobId: art.exportJobId && String(art.exportJobId).trim() ? String(art.exportJobId).trim() : null,
        artifactStatus:
          art.exportJobId && String(art.exportJobId).trim() ? 'audio_available' : art.readingSnapshot ? 'text_available' : 'not_generated',
      });
    })();
  }, [group, user?.id, stored, storedLoading]);

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
          <Link href="/community" className="text-accent hover:underline mt-2 inline-block">
            ← Back to Community
          </Link>
        </div>
      </AppShell>
    );
  }

  const readingText = textFromReadingSnapshot(stored?.readingSnapshot);
  const exId = stored?.exportJobId && String(stored.exportJobId).trim() ? String(stored.exportJobId).trim() : null;
  const hasExportRef = !!(stored?.exportJobId && String(stored.exportJobId).trim());
  const artifactStatus = stored?.artifactStatus || 'not_generated';

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
          <h1 className="text-h2 font-bold text-text">{group.name}</h1>
          <p className="text-subtext mt-1">{group.description}</p>
          <p className="text-sm text-subtext mt-2">{group.memberCount ?? members.length} members</p>
          <p className="text-sm text-subtext mt-2">
            Artifact: {storedLoading ? '…' : groupArtifactLabel(artifactStatus, hasExportRef)}
          </p>
        </header>

        <section className="rounded-lg border border-border bg-surface-1 p-4 space-y-2">
          <h2 className="text-lg font-medium text-text">Group reading</h2>
          {storedLoading && <p className="text-sm text-subtext">Loading stored reading…</p>}
          {!storedLoading && readingText ? <p className="text-sm text-text whitespace-pre-wrap">{readingText}</p> : null}
          {!storedLoading && !readingText ? (
            <p className="text-sm text-subtext">
              {user?.id === group.ownerId
                ? 'No stored reading yet. A reading will be prepared when the group composition is available.'
                : 'No stored reading for this group yet. The group owner may need to open the group once to generate a stored reading.'}
            </p>
          ) : null}
        </section>

        {exId ? (
          <section className="space-y-2">
            <h2 className="text-lg font-medium text-text">Sound</h2>
            <ValidatedExportAudioPlayer exportId={exId} />
          </section>
        ) : null}

        {profile && (profile.explanation?.sections?.length ?? 0) > 0 && (
          <section className="rounded-lg border border-dashed border-border bg-surface-1/50 p-4">
            <h2 className="text-base font-medium text-text mb-2">Aggregate profile (context)</h2>
            {profile.explanation?.sections?.map((s, i) => (
              <div key={i} className="mb-2">
                <h3 className="text-sm font-medium text-subtext">{s?.title}</h3>
                <p className="text-sm text-text">{s?.text}</p>
              </div>
            ))}
          </section>
        )}

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
