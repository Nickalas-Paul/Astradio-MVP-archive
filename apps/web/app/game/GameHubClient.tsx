'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';
import { useProfile } from '@/core/social/hooks';
import { DEFAULT_PROFILE_CHART_ID, hasRealChart } from '@/core/social/constants';
import { createSoloCampaign, listCampaigns, GameApiError } from '@/lib/game-api';

type CampaignListItem = {
  campaignId: string;
  mode?: string;
  updatedAt?: string;
  stateJson?: {
    hp?: { current?: number; max?: number; wounded?: boolean };
    streak?: number;
    chapter?: number;
    saturnChapter?: { label?: string; currentHouse?: number };
  };
};

function previewFromState(state: CampaignListItem['stateJson']): {
  hpLabel: string;
  streak: number;
  chapter: number;
  saturnLabel: string;
} {
  const hp = state?.hp;
  const hpLabel =
    hp && typeof hp.current === 'number' && typeof hp.max === 'number'
      ? `${hp.current}/${hp.max}`
      : '—';
  return {
    hpLabel,
    streak: typeof state?.streak === 'number' ? state.streak : 0,
    chapter: typeof state?.chapter === 'number' ? state.chapter : 1,
    saturnLabel: state?.saturnChapter?.label || 'Unknown dungeon',
  };
}

export function GameHubClient() {
  const router = useRouter();
  const { user, primaryChart, loading: profileLoading } = useProfile();
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateOff, setGateOff] = useState(false);

  const realChart = hasRealChart(primaryChart) ? primaryChart : null;
  const noRealChart = !realChart || primaryChart?.id === DEFAULT_PROFILE_CHART_ID;

  const load = useCallback(async () => {
    if (!user) {
      setCampaigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setGateOff(false);
    try {
      const data = await listCampaigns();
      const list = Array.isArray(data.campaigns) ? (data.campaigns as CampaignListItem[]) : [];
      setCampaigns(list.filter((c) => c.campaignId));
    } catch (e) {
      if (e instanceof GameApiError && e.status === 503) {
        setGateOff(true);
      }
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!profileLoading) void load();
  }, [profileLoading, load]);

  const soloCampaign = useMemo(
    () => campaigns.find((c) => !c.mode || c.mode === 'solo') || campaigns[0] || null,
    [campaigns]
  );

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await createSoloCampaign();
      router.push(`/game/${encodeURIComponent(created.campaignId)}`);
    } catch (e) {
      if (e instanceof GameApiError && e.status === 503) {
        setGateOff(true);
      }
      setError(e instanceof Error ? e.message : 'Failed to create campaign');
      setCreating(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 text-center"
        >
          <h1 className="font-serif text-h1 font-bold text-text-primary">Your Campaign</h1>
          <p className="text-lg text-text-secondary">The planets are testing you.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          {profileLoading || (user && loading) ? (
            <Card elevation="resting" size="lg" className="animate-pulse space-y-3">
              <div className="h-6 w-1/3 rounded bg-white/10" />
              <div className="h-4 w-2/3 rounded bg-white/5" />
              <div className="h-10 w-40 rounded bg-white/10" />
            </Card>
          ) : user === null ? (
            <Card elevation="resting" size="lg" className="space-y-3 text-center">
              <p className="text-body-sm text-text-secondary">Sign in to begin your campaign.</p>
              <p>
                <Link href="/profile" className="text-accent hover:underline">
                  Sign in on My Sky
                </Link>
              </p>
            </Card>
          ) : noRealChart ? (
            <Card elevation="resting" size="lg" className="space-y-3 text-center">
              <p className="text-body-sm text-text-secondary">
                Create your chart on My Sky first — your natal sky becomes your character.
              </p>
              <p>
                <Link href="/profile" className="text-accent hover:underline">
                  Go to My Sky
                </Link>
              </p>
            </Card>
          ) : gateOff ? (
            <Card elevation="resting" size="lg" className="space-y-2 text-center">
              <p className="font-serif text-h4 text-text-primary">Game combat is offline</p>
              <p className="text-body-sm text-text-secondary">
                The dungeon gate is closed for now. Check back when combat is enabled.
              </p>
            </Card>
          ) : soloCampaign ? (
            <Card elevation="raised" size="lg" className="space-y-4">
              {(() => {
                const preview = previewFromState(soloCampaign.stateJson);
                return (
                  <>
                    <div>
                      <p className="text-caption uppercase tracking-wide text-accent">Active campaign</p>
                      <h2 className="mt-1 font-serif text-h3 text-text-primary">Resume Campaign</h2>
                      <p className="mt-2 text-body-sm text-text-secondary">
                        Chapter {preview.chapter} · Streak: {preview.streak}
                      </p>
                      <p className="text-body-sm text-text-muted">
                        HP: {preview.hpLabel} · {preview.saturnLabel}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => router.push(`/game/${encodeURIComponent(soloCampaign.campaignId)}`)}
                    >
                      Resume Campaign
                    </Button>
                    {error ? <p className="text-body-sm text-danger">{error}</p> : null}
                  </>
                );
              })()}
            </Card>
          ) : (
            <div className="space-y-6">
              <Card elevation="raised" size="lg" className="space-y-4 text-center sm:text-left">
                <div>
                  <h2 className="font-serif text-h3 text-text-primary">Begin Solo Campaign</h2>
                  <p className="mt-2 text-body-sm text-text-secondary">
                    Your chart becomes your character. The sky becomes your dungeon.
                  </p>
                </div>
                <Button variant="primary" loading={creating} onClick={() => void handleCreate()}>
                  Begin Solo Campaign
                </Button>
                {error ? <p className="text-body-sm text-danger">{error}</p> : null}
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
