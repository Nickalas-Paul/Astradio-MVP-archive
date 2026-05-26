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
      <div className="card space-y-6">
        <div className="h-8 w-48 bg-bgElev rounded animate-pulse" />
        <div className="aspect-square max-w-md bg-bgElev rounded-2xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-4 bg-bgElev rounded w-full animate-pulse" />
          <div className="h-4 bg-bgElev rounded w-3/4 animate-pulse" />
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="card">
        <p className="text-subtext text-sm">{profileError}</p>
      </div>
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
              <button
                type="button"
                onClick={onSwitchToConnections}
                className="btn-primary text-sm"
              >
                Find connections
              </button>
            )}
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-border text-subtext text-sm hover:bg-bgElev"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
                await refresh();
              }}
            >
              Log out
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border pb-2" role="tablist">
          {(['active', 'identity', 'library'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              className={`px-4 py-2 rounded-t-lg text-sm font-medium ${
                profileSection === s ? 'bg-bgElev text-text border border-b-0 border-border' : 'text-subtext'
              }`}
              onClick={() => setProfileSection(s)}
            >
              {s === 'active' ? 'Current Transit' : s === 'identity' ? 'Identity' : 'Library'}
            </button>
          ))}
        </div>

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

        <ProfilePanelFooter user={user} onPrivacyUpdate={() => refresh()} />
      </motion.div>
    </div>
  );
}
