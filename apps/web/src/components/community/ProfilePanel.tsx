'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useProfile } from '../../core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import { ProfileAuthPanel } from '../profile/ProfileAuthPanel';
import { ProfileHeaderCard } from '../profile/ProfileHeaderCard';
import { IdentityPanel } from '../profile/IdentityPanel';
import { LibraryPanel, type LibraryPanelHandle } from '../profile/LibraryPanel';
import { Button } from '@/components/shared/Button';
import { Tabs } from '@/components/shared/Tabs';
import { Card } from '@/components/shared/Card';
import { FtueTodayBridgeNudge } from '../ftue/FtueTodayBridgeNudge';

const MotionCard = motion(Card);

export { filterIdentityDisplaySections } from '../profile/shared/profile-reading-utils';

export interface ProfilePanelProps {
  onSwitchToConnections?: () => void;
}

export function ProfilePanel({ onSwitchToConnections }: ProfilePanelProps) {
  const router = useRouter();
  const { user, primaryChart, loading: profileLoading, error: profileError, refresh } = useProfile();
  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const chartId = realChart?.id ?? null;
  const searchParams = useSearchParams();
  const [profileSection, setProfileSection] = useState<'identity' | 'library'>('identity');
  const libraryRef = useRef<LibraryPanelHandle>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'active') {
      router.replace('/today');
      return;
    }
    if (tab === 'identity' || tab === 'library') {
      setProfileSection(tab);
    }
  }, [searchParams, router]);

  if (profileLoading) {
    return (
      <Card className="space-y-6">
        <div className="h-8 w-48 bg-bgElev rounded animate-pulse" />
        <div className="aspect-square max-w-md bg-bgElev rounded-2xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-4 bg-bgElev rounded w-full animate-pulse" />
          <div className="h-4 bg-bgElev rounded w-3/4 animate-pulse" />
        </div>
      </Card>
    );
  }

  if (profileError) {
    return (
      <Card>
        <p className="text-text-secondary text-sm">{profileError}</p>
      </Card>
    );
  }

  if (user === null) {
    return <ProfileAuthPanel onAuthSuccess={refresh} />;
  }

  const noRealChart = !realChart || primaryChart?.id === DEFAULT_PROFILE_CHART_ID;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <MotionCard
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <ProfileHeaderCard
          user={user}
          primaryChart={primaryChart}
          onProfileRefresh={refresh}
          onLogout={async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
            await refresh();
          }}
        />

        {noRealChart && (
          <p className="text-sm text-amber-600 dark:text-amber-400 -mt-2">
            No chart linked. Add your birth chart when creating a profile, or use the Sandbox to build a chart.
          </p>
        )}

        {onSwitchToConnections && realChart && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-full sm:w-auto min-h-[44px]"
              onClick={onSwitchToConnections}
            >
              Find connections
            </Button>
          </div>
        )}

        <Tabs
          variant="underline"
          className="-mx-1 px-1"
          ariaLabel="Profile sections"
          tabs={[
            { id: 'identity', label: 'Identity' },
            { id: 'library', label: 'Library' },
          ]}
          activeTab={profileSection}
          onTabChange={(id) => setProfileSection(id as 'identity' | 'library')}
        />

        {profileSection === 'identity' && !noRealChart ? <FtueTodayBridgeNudge /> : null}

        {profileSection === 'identity' && (
          <IdentityPanel
            chartId={chartId}
            noRealChart={noRealChart}
            primaryChart={primaryChart}
            onProfileRefresh={() => refresh()}
          />
        )}

        <div className={profileSection === 'library' ? undefined : 'hidden'} aria-hidden={profileSection !== 'library'}>
          <LibraryPanel
            ref={libraryRef}
            chartId={chartId}
            shouldLoad={profileSection === 'library'}
          />
        </div>
      </MotionCard>
    </div>
  );
}
