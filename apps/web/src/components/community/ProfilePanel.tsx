'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { useProfile } from '../../core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '../../core/social/constants';
import { ProfileAuthPanel } from '../profile/ProfileAuthPanel';
import { ActiveTransitPanel } from '../profile/ActiveTransitPanel';
import { IdentityPanel } from '../profile/IdentityPanel';
import { LibraryPanel, type LibraryPanelHandle } from '../profile/LibraryPanel';
import { ProfilePanelFooter } from '../profile/ProfilePanelFooter';
import { Button } from '@/components/shared/Button';
import { Tabs } from '@/components/shared/Tabs';
import { Card } from '@/components/shared/Card';

export { filterIdentityDisplaySections } from '../profile/shared/profile-reading-utils';

export interface ProfilePanelProps {
  onSwitchToConnections?: () => void;
}

export function ProfilePanel({ onSwitchToConnections }: ProfilePanelProps) {
  const { user, primaryChart, loading: profileLoading, error: profileError, refresh } = useProfile();
  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const chartId = realChart?.id ?? null;
  const searchParams = useSearchParams();
  const [profileSection, setProfileSection] = useState<'active' | 'identity' | 'library'>('active');
  const [librarySaveError, setLibrarySaveError] = useState<string | null>(null);
  const libraryRef = useRef<LibraryPanelHandle>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'active' || tab === 'identity' || tab === 'library') {
      setProfileSection(tab);
    }
  }, [searchParams]);

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
        <p className="text-subtext text-sm">{profileError}</p>
      </Card>
    );
  }

  if (user === null) {
    return <ProfileAuthPanel onAuthSuccess={refresh} />;
  }

  const noRealChart = !realChart || primaryChart?.id === DEFAULT_PROFILE_CHART_ID;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text">{user.displayName}</h2>
            {realChart && (
              <p className="text-sm text-subtext mt-1">
                {primaryChart!.label} · {primaryChart!.date} {primaryChart!.time}
              </p>
            )}
            {noRealChart && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                No chart linked. Add your birth chart when creating a profile, or use the Sandbox to build a chart.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSwitchToConnections && realChart && (
              <Button type="button" variant="primary" size="sm" onClick={onSwitchToConnections}>
                Find connections
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                await refresh();
              }}
            >
              Log out
            </Button>
          </div>
        </div>

        <Tabs
          variant="underline"
          ariaLabel="Profile sections"
          tabs={[
            { id: 'active', label: 'Current Transit' },
            { id: 'identity', label: 'Identity' },
            { id: 'library', label: 'Library' },
          ]}
          activeTab={profileSection}
          onTabChange={(id) => setProfileSection(id as 'active' | 'identity' | 'library')}
        />

        {profileSection === 'active' && (
          <ActiveTransitPanel
            chartId={chartId}
            noRealChart={noRealChart}
            librarySaveError={librarySaveError}
            onSaved={() => void libraryRef.current?.refresh()}
            onSaveError={(msg) => setLibrarySaveError(msg)}
            onClearSaveError={() => setLibrarySaveError(null)}
          />
        )}

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

        <div className="border-t border-border pt-6 mt-6">
          <ProfilePanelFooter user={user} onPrivacyUpdate={() => refresh()} />
        </div>
      </motion.div>
    </div>
  );
}
