'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ProfileHeader } from '@/components/ProfileHeader';
import { BriefIdentitySummary } from '@/components/BriefIdentitySummary';
import { ProfileCompatibilityPanel } from '@/components/ProfileCompatibilityPanel';
import { ProfilePersonalizationDisplay } from '@/components/profile/ProfilePersonalizationDisplay';
import { ExplainerSections } from '@/components/profile/shared/ExplainerSections';
import { filterIdentityDisplaySections } from '@/components/profile/shared/profile-reading-utils';
import { ValidatedExportAudioPlayer } from '@/components/community/ValidatedExportAudioPlayer';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { useProfile, useProfileChart } from '@/core/social/hooks';
import type { ProfileChartSection } from '@/core/social/hooks';
import type { SynastryBulletLine } from '@/core/compat/types';
import type { RelationalIntent } from '@/lib/relational-intent';

type ProfileUser = {
  id: string;
  displayName?: string;
  handle?: string;
  bio?: string;
  lookingFor?: string;
  chartHighlights?: string[];
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

/** Public-safe subtitle: birth date only (no time, coordinates, or place label). */
function formatBirthData(chart: PrimaryChart | null): string | undefined {
  if (!chart?.date) return undefined;
  return chart.date;
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

function IdentityReadingSections({ sections }: { sections: ProfileChartSection[] }) {
  const displaySections = filterIdentityDisplaySections(sections);
  if (displaySections.length === 0) {
    return (
      <Card elevation="resting" padding="p-5">
        <p className="text-body-sm text-text-secondary">Chart identity report unavailable for this profile.</p>
      </Card>
    );
  }

  return <ExplainerSections sections={displaySections} />;
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
    <Card elevation="flat" padding="p-4" className="space-y-4">
      <h3 className="font-serif text-h3 font-semibold text-text-primary">Their natal soundtrack</h3>
      {chartLoading ? (
        <p className="text-body-sm text-text-secondary">Loading chart…</p>
      ) : exportId && /^[a-f0-9]{64}$/.test(exportId) ? (
        <ValidatedExportAudioPlayer exportId={exportId} />
      ) : (
        <p className="text-body-sm text-accent">Sound unavailable</p>
      )}
    </Card>
  );
}

function ConnectionActions({
  fromDiscovery,
  isOwnProfile,
  onBackToMatches,
}: {
  fromDiscovery: boolean;
  isOwnProfile: boolean;
  onBackToMatches?: () => void;
}) {
  if (isOwnProfile) return null;

  return (
    <div className="flex flex-col sm:flex-row gap-3 pt-2">
      <Button
        type="button"
        variant="primary"
        size="md"
        className="flex-1 sm:flex-none"
        disabled
        title="Connection requests (Phase 6C-2)"
      >
        Request connection
      </Button>
      {fromDiscovery && onBackToMatches ? (
        <Button
          type="button"
          variant="outline"
          size="md"
          className="flex-1 sm:flex-none"
          onClick={onBackToMatches}
        >
          Back to matches
        </Button>
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
      const res = await fetch(`/api/profile/${encodeURIComponent(param)}`);
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
        <div className="max-w-3xl mx-auto p-6 text-body-sm text-text-secondary">Loading profile…</div>
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
            className="text-accent hover:underline mt-2 inline-block text-sm"
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
          className="text-body-sm text-accent hover:underline inline-block"
        >
          ← {fromDiscovery ? 'Back to matches' : 'Connections'}
        </Link>

        <ProfileHeader
          user={{
            displayName: targetUser.displayName || targetUser.id,
            birthData,
            photoUrl: targetUser.avatarUrl,
          }}
          isOwnProfile={isOwnProfile}
          onEditProfile={isOwnProfile ? () => router.push('/profile') : undefined}
        />

        <ProfilePersonalizationDisplay
          bio={targetUser.bio}
          lookingFor={targetUser.lookingFor}
          chartHighlights={targetUser.chartHighlights}
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

            <ConnectionActions
              fromDiscovery={fromDiscovery}
              isOwnProfile={isOwnProfile}
              onBackToMatches={() => router.push('/community?tab=discovery')}
            />
          </>
        ) : (
          <>
            {chartLoading ? (
              <p className="text-sm text-text-secondary">Loading chart…</p>
            ) : (
              <>
                <BriefIdentitySummary
                  chartData={chartExplainer}
                  sections={identitySections}
                  profilePath={fullNatalProfilePath}
                  showFullChartLink={false}
                />
                <IdentityReadingSections sections={identitySections} />
              </>
            )}

            {showCompatibility && seekerChart?.id && targetChartId ? (
              <ProfileCompatibilityPanel
                seekerChartId={seekerChart.id}
                targetChartId={targetChartId}
                intent={intent}
                discoveryBullets={discoveryBullets}
              />
            ) : null}

            <ConnectionActions
              fromDiscovery={fromDiscovery}
              isOwnProfile={isOwnProfile}
              onBackToMatches={() => router.push('/community?tab=discovery')}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}
