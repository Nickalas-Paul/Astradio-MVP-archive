'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useProfile, useUserSearch, useProfileChart, type ProfileChartSection, type DirectoryUser } from '../../core/social/hooks';
import { getApiBaseUrl } from '../../core/api-base';
import { hasRealChart } from '../../core/social/constants';
import type { RelationalIntent } from '../../lib/relational-intent';

const WheelCanvas = dynamic(
  () => import('../WheelCanvas').then((m) => m.default),
  { ssr: false, loading: () => <div className="aspect-square bg-bgElev rounded-2xl border border-border animate-pulse" /> }
);

const SECTION_ORDER = ['signatures', 'significance', 'musical'];
const SECTION_TITLES: Record<string, string> = {
  signatures: 'Astrology',
  significance: 'Personal Significance',
  musical: 'Music Theory',
};

function ExplainerSections({ sections }: { sections: ProfileChartSection[] }) {
  const sorted = [...sections].sort(
    (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id)
  );
  return (
    <div className="space-y-4">
      {sorted.map((sec) => (
        <section key={sec.id} className="rounded-lg border border-border bg-bgElev p-3">
          <h4 className="text-sm font-semibold text-text mb-2">{SECTION_TITLES[sec.id] ?? sec.title}</h4>
          <div className="text-subtext text-xs leading-relaxed whitespace-pre-wrap">{sec.text}</div>
          {sec.bullets?.length ? (
            <ul className="mt-2 list-disc list-inside text-subtext text-xs space-y-0.5">
              {sec.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function snapshotSafeForWheel(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const o = snapshot as Record<string, unknown>;
  const planets = o.planets ?? o.positions;
  const houses = o.houses ?? o.cusps;
  return (Array.isArray(planets) && planets.length > 0) || (Array.isArray(houses) && houses.length >= 12);
}

export interface UserSearchPanelProps {
  onInventoryRefresh?: () => void;
  /** Used for POST /api/community/connect-intent relationshipKind (default friend). */
  relationshipKind?: RelationalIntent;
}

export function UserSearchPanel({ onInventoryRefresh, relationshipKind = 'friend' }: UserSearchPanelProps = {}) {
  const [q, setQ] = useState('');
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [groupPick, setGroupPick] = useState<Record<string, boolean>>({});
  const [groupName, setGroupName] = useState('');
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupMsg, setGroupMsg] = useState<string | null>(null);
  const [connMsg, setConnMsg] = useState<string | null>(null);

  const { primaryChart, user } = useProfile();
  const { users, loading, error, refresh } = useUserSearch({ q, limit: 15 });
  const { data: profileChartData, loading: profileLoading, error: profileError } = useProfileChart(selectedChartId);
  const chartAId = hasRealChart(primaryChart) ? primaryChart.id : null;
  const profilePreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedChartId) return;
    profilePreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedChartId]);

  const handleRequestConnection = async (target: DirectoryUser) => {
    if (!chartAId || !user?.id) {
      setConnMsg('Add your chart in Profile and sign in to request a connection.');
      return;
    }
    setConnMsg(null);
    try {
      const base = getApiBaseUrl() || '';
      const r = await fetch(`${base}/api/community/connect-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          toUserId: target.userId,
          fromChartId: chartAId,
          toChartId: target.chartId,
          relationshipKind,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setConnMsg(typeof data.error === 'string' ? data.error : `Request failed (${r.status})`);
        return;
      }
      setConnMsg(`Connection request sent to ${target.displayName}. They must accept before it appears in Connections.`);
      onInventoryRefresh?.();
    } catch (e) {
      setConnMsg(e instanceof Error ? e.message : 'Request failed');
    }
  };

  const createRelationalGroupFromSearch = async () => {
    if (!chartAId || !user?.id) {
      setGroupMsg('Add your chart in Profile first.');
      return;
    }
    const picked = users.filter((u) => groupPick[u.userId] && u.userId !== user.id);
    if (picked.length < 1) {
      setGroupMsg('Select at least one other person for a relational chart group.');
      return;
    }
    if (!groupName.trim()) {
      setGroupMsg('Enter a short group name.');
      return;
    }
    setGroupBusy(true);
    setGroupMsg(null);
    try {
      const base = getApiBaseUrl() || '';
      const slug = `rg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const gr = await fetch(`${base}/api/groups`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName.trim(),
          slug,
          description: 'Relational chart group (Community)',
        }),
      });
      const gj = await gr.json().catch(() => ({}));
      if (!gr.ok) throw new Error(typeof gj.error === 'string' ? gj.error : `Create group ${gr.status}`);
      const groupId = gj.id as string;
      const ma = await fetch(`${base}/api/groups/${encodeURIComponent(groupId)}/members`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartId: chartAId }),
      });
      const mj = await ma.json().catch(() => ({}));
      if (!ma.ok) throw new Error(typeof mj.error === 'string' ? mj.error : `Add your chart ${ma.status}`);
      for (const u of picked) {
        const ir = await fetch(`${base}/api/groups/${encodeURIComponent(groupId)}/invites`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteeUserId: u.userId, inviteeChartId: u.chartId }),
        });
        const ij = await ir.json().catch(() => ({}));
        if (!ir.ok) throw new Error(typeof ij.error === 'string' ? ij.error : `Invite ${ir.status}`);
      }
      setGroupMsg('Relational group created; invites sent. Others accept under Connections.');
      setGroupPick({});
      setGroupName('');
      onInventoryRefresh?.();
    } catch (e) {
      setGroupMsg(e instanceof Error ? e.message : 'Group creation failed');
    } finally {
      setGroupBusy(false);
    }
  };

  const qTrimmed = (q || '').trim();
  const canSearch = qTrimmed.length >= 2;

  return (
    <div className="card space-y-6">
      <h2 className="text-xl font-semibold text-text">Find people</h2>
      <p className="text-sm text-subtext">
        Search by name or handle (min 2 characters). Directory results only. Request connection for a saved link (peer must accept). Select people below
        to build a relational chart group — you are added first; others get invites.
      </p>

      {connMsg && <p className="text-sm text-subtext border border-border rounded-lg px-3 py-2 bg-bgElev">{connMsg}</p>}

      <div className="rounded-lg border border-border bg-bgElev p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text">Relational chart group from selection</h3>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name (e.g. Study circle)"
          className="input w-full max-w-md"
        />
        {groupMsg && <p className="text-sm text-amber-600 dark:text-amber-400">{groupMsg}</p>}
        <button
          type="button"
          disabled={groupBusy || !chartAId}
          onClick={() => createRelationalGroupFromSearch()}
          className="px-4 py-2 rounded-lg bg-emerald text-bg text-sm font-medium disabled:opacity-50"
        >
          {groupBusy ? 'Creating…' : 'Create group & send invites'}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search by name or handle (min 2 chars)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input flex-1"
        />
        <button type="button" onClick={() => refresh()} disabled={loading || !canSearch} className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">
          Search
        </button>
      </div>

      {qTrimmed.length > 0 && qTrimmed.length < 2 && (
        <p className="text-subtext text-sm">Enter at least 2 characters to search.</p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && <div className="text-subtext text-sm">Loading…</div>}

      {!loading && users.length === 0 && canSearch && (
        <p className="text-subtext text-sm">No users found. Results are limited to the directory; try a different query.</p>
      )}

      {!loading && users.length > 0 && (
        <ul className="space-y-2">
          {users.map((u) => (
            <li
              key={u.userId}
              className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-bgElev"
            >
              <div className="flex items-start gap-2">
                {u.userId !== user?.id ? (
                  <label className="flex items-center gap-2 text-xs text-subtext cursor-pointer mt-0.5">
                    <input
                      type="checkbox"
                      checked={!!groupPick[u.userId]}
                      onChange={() =>
                        setGroupPick((p) => ({
                          ...p,
                          [u.userId]: !p[u.userId],
                        }))
                      }
                    />
                    Group
                  </label>
                ) : null}
                <div>
                <span className="font-medium text-text">{u.displayName}</span>
                {u.handle ? (
                  <span className="text-subtext text-sm ml-2">{u.handle}</span>
                ) : (
                  <span className="text-subtext text-sm ml-2">{u.userId}</span>
                )}
                {u.label && <span className="text-subtext text-xs ml-2">· {u.label}</span>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChartId(selectedChartId === u.chartId ? null : u.chartId)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-bgElev border border-border text-subtext hover:text-text"
                >
                  {selectedChartId === u.chartId ? 'Hide profile' : 'View profile'}
                </button>
                {u.userId !== user?.id ? (
                  <button
                    type="button"
                    onClick={() => handleRequestConnection(u)}
                    className="px-3 py-1.5 rounded-lg text-sm bg-violet/20 text-violet border border-violet/40 hover:bg-violet/30"
                  >
                    Request connection
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {selectedChartId && (
        <div ref={profilePreviewRef} className="border-t border-border pt-6 mt-6 scroll-mt-8">
          <h3 className="text-lg font-semibold text-text mb-4">Profile</h3>
          {profileLoading && <div className="text-subtext text-sm">Loading chart…</div>}
          {profileError && <p className="text-subtext text-sm">{profileError}</p>}
          {profileChartData && (
            <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
              <div>
                {profileChartData.snapshot && snapshotSafeForWheel(profileChartData.snapshot) ? (
                  <WheelCanvas
                    chartData={profileChartData.snapshot as any}
                    isLoading={false}
                    className="max-w-full"
                  />
                ) : (
                  <div className="aspect-square bg-bgElev rounded-2xl border border-border flex items-center justify-center text-subtext text-sm p-4">
                    Chart data received; wheel needs planets/houses.
                  </div>
                )}
              </div>
              <div className="min-w-0">
                {profileChartData.explainer?.sections?.length ? (
                  <ExplainerSections sections={profileChartData.explainer.sections} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
