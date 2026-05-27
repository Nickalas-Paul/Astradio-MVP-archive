'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ProfileHeader } from '@/components/ProfileHeader';
import { BriefIdentitySummary } from '@/components/BriefIdentitySummary';
import { ProfileCompatibilityPanel } from '@/components/ProfileCompatibilityPanel';
import { ValidatedExportAudioPlayer } from '@/components/community/ValidatedExportAudioPlayer';
import { useProfile, useProfileChart } from '@/core/social/hooks';
import type { ProfileChartSection } from '@/core/social/hooks';
import type { SynastryBulletLine } from '@/core/compat/types';
import type { RelationalIntent } from '@/lib/relational-intent';

type ProfileUser = {
  id: string;
  displayName?: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
};

type PrimaryChart = {
  id: string;
  label?: string;
  date?: string;
  time?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
};

function formatBirthData(chart: PrimaryChart | null): string | undefined {
  if (!chart?.date) return undefined;
  const time = chart.time?.slice(0, 5) || chart.time;
  return time ? `${chart.date} · ${time}` : chart.date;
}

function readDiscoveryBullets(userId: string): {
  forThem?: SynastryBulletLine;
  forYou?: SynastryBulletLine;
  together?: SynastryBulletLine;
} | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = sessionStorage.getItem(`discovery-bullets:${userId}`);
    if (!raw) return undefined;
    return JSON.parse(raw) as {
      forThem?: SynastryBulletLine;
      forYou?: SynastryBulletLine;
      together?: SynastryBulletLine;
    };
  } catch {
    return undefined;
  }
}

function FullNatalReport({ sections }: { sections: ProfileChartSection[] }) {
  if (sections.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-surface-1 p-5">
        <p className="text-sm text-subtext">Chart identity report unavailable for this profile.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
      <h2 className="text-lg font-semibold text-text">Core identity</h2>
      {sections.map((section) => (
        <div key={section.id} className="space-y-2">
          {section.title ? <h3 className="text-sm font-medium text-text">{section.title}</h3> : null}
          {section.text ? <p className="text-body text-text-secondary">{section.text}</p> : null}
          {section.bullets?.length ? (
            <ul className="list-disc list-inside text-sm text-subtext space-y-1">
              {section.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/**
 * Natal soundtrack on Discovery profile preview.
 * Uses identity_export_id from GET /api/profile/chart; WAV served via /api/exports/:id.
 */
function NatalSoundtrackSection({
  exportId,
  chartLoading,
}: {
  exportId: string | null | undefined;
  chartLoading: boolean;
}) {
  return (
    <section className="mb-8">
      <h3 className="text-sm font-medium text-text mb-3">Their natal soundtrack</h3>
      {chartLoading ? (
        <p className="text-sm text-subtext">Loading chart…</p>
      ) : exportId && /^[a-f0-9]{64}$/.test(exportId) ? (
        <ValidatedExportAudioPlayer exportId={exportId} />
      ) : (
        <div className="bg-surface rounded-lg p-4">
          <p className="text-sm text-subtext">Audio not yet available for this chart</p>
        </div>
      )}
    </section>
  );
}

function ConnectionActions({
  fromDiscovery,
  isOwnProfile,
}: {
  fromDiscovery: boolean;
  isOwnProfile: boolean;
}) {
  if (isOwnProfile) return null;

  return (
    <div className="flex flex-wrap gap-3 pt-2">
      <button
        type="button"
        disabled
        className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
        title="Connection requests — Phase 6C-2"
      >
        Request connection
      </button>
      {fromDiscovery ? (
        <Link
          href="/community?tab=discovery"
          className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-subtext hover:text-text hover:border-accent/50 transition-colors"
        >
          Back to matches
        </Link>
      ) : null}
    </div>
  );
}

export default function ProfileByHandlePage({ params }: { params: { handle: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = typeof params?.handle === 'string' ? decodeURIComponent(params.handle) : '';

  const fromDiscovery = searchParams.get('from') === 'discovery';
  const intentParam = searchParams.get('intent');
  const intent: RelationalIntent =
    intentParam === 'partner' || intentParam === 'lover' ? 'lover' : 'friend';
  const chartIdOverride = searchParams.get('chartId')?.trim() || null;

  const { user: sessionUser, primaryChart: seekerChart, loading: sessionLoading } = useProfile();

  const [targetUser, setTargetUser] = useState<ProfileUser | null>(null);
  const [targetChart, setTargetChart] = useState<PrimaryChart | null>(null);
  const [profileLoading, setProfileLoading] = useState(!!param);
  const [discoveryBullets, setDiscoveryBullets] = useState<
    | {
        forThem?: SynastryBulletLine;
        forYou?: SynastryBulletLine;
        together?: SynastryBulletLine;
      }
    | undefined
  >(undefined);

  const targetChartId = chartIdOverride || targetChart?.id || null;
  const { data: chartExplainer, loading: chartLoading } = useProfileChart(targetChartId);

  const isOwnProfile = Boolean(sessionUser?.id && targetUser?.id && sessionUser.id === targetUser.id);
  const showCompatibility =
    fromDiscovery && !isOwnProfile && Boolean(seekerChart?.id && targetChartId);

  const fullNatalProfilePath = targetUser
    ? `/profile/${encodeURIComponent(targetUser.handle || targetUser.id)}`
    : '#';

  const loadProfile = useCallback(async () => {
    if (!param) {
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setTargetUser(null);
    setTargetChart(null);
    try {
      let res = await fetch(`/api/profile/user/${encodeURIComponent(param)}`);
      if (!res.ok) {
        res = await fetch(`/api/profile/${encodeURIComponent(param)}`);
      }
      if (!res.ok) {
        setProfileLoading(false);
        return;
      }
      const data = await res.json();
      const u = data.user as ProfileUser | null;
      const pc = data.primaryChart as PrimaryChart | null;
      if (!u?.id) {
        setProfileLoading(false);
        return;
      }
      setTargetUser(u);
      setTargetChart(pc);
      if (fromDiscovery) {
        setDiscoveryBullets(readDiscoveryBullets(u.id));
      }
    } catch {
      // ignore
    } finally {
      setProfileLoading(false);
    }
  }, [param, fromDiscovery]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const birthData = useMemo(() => formatBirthData(targetChart), [targetChart]);

  const identitySections = chartExplainer?.explainer?.sections ?? [];

  if (profileLoading || (fromDiscovery && sessionLoading)) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6 text-subtext">Loading profile…</div>
      </AppShell>
    );
  }

  if (!targetUser) {
    return (
      <AppShell>
        <div className="max-w-3xl mx-auto p-6">
          <p className="text-red-500">User not found</p>
          <Link
            href="/community?tab=discovery"
            className="text-accent-light hover:underline mt-2 inline-block text-sm"
          >
            ← Back to Discovery
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <Link
          href={fromDiscovery ? '/community?tab=discovery' : '/community'}
          className="text-subtext hover:text-text text-sm inline-block"
        >
          ← {fromDiscovery ? 'Back to matches' : 'Community'}
        </Link>

        <ProfileHeader
          user={{
            displayName: targetUser.displayName || targetUser.id,
            birthData,
            bio: targetUser.bio,
            photoUrl: targetUser.avatarUrl,
          }}
          isOwnProfile={isOwnProfile}
          onEditProfile={isOwnProfile ? () => router.push('/profile') : undefined}
        />

        {fromDiscovery && !isOwnProfile ? (
          <>
            <BriefIdentitySummary
              chartData={chartExplainer}
              sections={identitySections}
              profilePath={fullNatalProfilePath}
              loading={chartLoading}
            />

            <NatalSoundtrackSection
              exportId={chartExplainer?.identity_export_id}
              chartLoading={chartLoading}
            />

            {showCompatibility && seekerChart?.id && targetChartId ? (
              <ProfileCompatibilityPanel
                seekerChartId={seekerChart.id}
                targetChartId={targetChartId}
                intent={intent}
                discoveryBullets={discoveryBullets}
              />
            ) : null}

            <ConnectionActions fromDiscovery={fromDiscovery} isOwnProfile={isOwnProfile} />
          </>
        ) : (
          <>
            {chartLoading ? (
              <p className="text-sm text-subtext">Loading chart…</p>
            ) : (
              <FullNatalReport sections={identitySections} />
            )}

            {showCompatibility && seekerChart?.id && targetChartId ? (
              <ProfileCompatibilityPanel
                seekerChartId={seekerChart.id}
                targetChartId={targetChartId}
                intent={intent}
                discoveryBullets={discoveryBullets}
              />
            ) : null}

            <ConnectionActions fromDiscovery={fromDiscovery} isOwnProfile={isOwnProfile} />
          </>
        )}
      </div>
    </AppShell>
  );
}
