'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type CampaignListItem = {
  campaignId: string;
  mode?: string;
  updatedAt?: string;
};

export function CampaignEntryClient() {
  const router = useRouter();
  const [loadingList, setLoadingList] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'solo' | 'group' | 'auto' | 'resume' | null>(null);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const r = await fetch('/api/campaigns', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      const data = (await r.json().catch(() => ({}))) as { campaigns?: CampaignListItem[]; error?: string };
      if (r.status === 401) {
        setSignedIn(false);
        setCampaigns([]);
        return;
      }
      if (!r.ok) {
        setSignedIn(true);
        throw new Error(data?.error || `Failed to load campaigns (${r.status})`);
      }
      setSignedIn(true);
      const list = Array.isArray(data.campaigns) ? data.campaigns : [];
      setCampaigns(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCampaigns([]);
    } finally {
      setLoadingList(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const pickResumeTarget = useCallback((): string | null => {
    if (campaigns.length === 0) return null;
    const sorted = [...campaigns].sort((a, b) => {
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return tb - ta;
    });
    const id = sorted[0]?.campaignId;
    return typeof id === 'string' && id.trim() ? id.trim() : null;
  }, [campaigns]);

  const navigateToCampaign = useCallback(
    (campaignId: string) => {
      router.push(`/rpg/campaign/${encodeURIComponent(campaignId)}`);
    },
    [router]
  );

  const createThenGo = useCallback(
    async (mode: 'solo' | 'group' | 'auto') => {
      setBusy(mode);
      setError(null);
      try {
        const body = mode === 'solo' ? { mode: 'solo' } : { mode: 'auto' };
        const r = await fetch('/api/campaigns/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(body),
        });
        const data = (await r.json().catch(() => ({}))) as { campaignId?: string; error?: string; message?: string };
        if (!r.ok) {
          throw new Error(data?.message || data?.error || `Create failed (${r.status})`);
        }
        const id = data.campaignId;
        if (!id || typeof id !== 'string') {
          throw new Error('Create succeeded but no campaignId returned');
        }
        navigateToCampaign(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [navigateToCampaign]
  );

  const onResume = useCallback(() => {
    const id = pickResumeTarget();
    if (!id) {
      setError('No campaign to resume.');
      return;
    }
    setBusy('resume');
    setError(null);
    try {
      navigateToCampaign(id);
    } finally {
      setBusy(null);
    }
  }, [navigateToCampaign, pickResumeTarget]);

  if (!authChecked || loadingList) {
    return (
      <main className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4">
        <p className="text-sm text-text-secondary">Loading…</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <main className="min-h-screen bg-bg text-text-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-4 rounded-lg border border-border bg-bgElev p-6 text-center">
          <h1 className="text-xl font-semibold">Campaign</h1>
          <p className="text-sm text-text-secondary">Sign in to start or resume a campaign.</p>
          <Link
            href="/login"
            className="inline-block rounded-md border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
          >
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  const canResume = campaigns.length > 0;
  const disableActions = busy !== null;

  return (
    <main className="min-h-screen bg-bg text-text-primary px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Campaign</h1>
          <p className="mt-1 text-sm text-text-secondary">Start solo, join via auto party, or resume where you left off.</p>
        </div>

        {error ? (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
        ) : null}

        <div className="space-y-3">
          {canResume ? (
            <button
              type="button"
              disabled={disableActions}
              onClick={onResume}
              className="w-full rounded-lg border border-accent/40 bg-accent/15 px-4 py-3 text-left text-sm font-medium text-text-primary hover:bg-accent/25 disabled:opacity-50"
            >
              {busy === 'resume' ? 'Opening…' : 'Resume campaign'}
              <span className="mt-1 block text-xs font-normal text-text-secondary">Opens your most recently updated campaign.</span>
            </button>
          ) : null}

          <button
            type="button"
            disabled={disableActions}
            onClick={() => void createThenGo('solo')}
            className="w-full rounded-lg border border-border bg-bgElev px-4 py-3 text-left text-sm font-medium hover:bg-white/[0.06] disabled:opacity-50"
          >
            {busy === 'solo' ? 'Creating…' : 'Start solo campaign'}
            <span className="mt-1 block text-xs font-normal text-text-secondary">Personal campaign using your primary chart.</span>
          </button>

          <button
            type="button"
            disabled={disableActions}
            onClick={() => void createThenGo('group')}
            className="w-full rounded-lg border border-border bg-bgElev px-4 py-3 text-left text-sm font-medium hover:bg-white/[0.06] disabled:opacity-50"
          >
            {busy === 'group' ? 'Creating…' : 'Start group campaign'}
            <span className="mt-1 block text-xs font-normal text-text-secondary">
              Auto-selects an eligible party from your groups (engine auto mode) until a group picker ships.
            </span>
          </button>

          <button
            type="button"
            disabled={disableActions}
            onClick={() => void createThenGo('auto')}
            className="w-full rounded-lg border border-dashed border-white/15 bg-transparent px-4 py-2.5 text-left text-sm text-text-secondary hover:border-white/25 hover:text-text-primary disabled:opacity-50"
          >
            {busy === 'auto' ? 'Creating…' : 'Auto party'}
            <span className="mt-1 block text-xs">Same as engine <code className="text-xs">mode: auto</code>, an optional shortcut.</span>
          </button>
        </div>

        <p className="text-xs text-text-secondary">
          Group picker (choose a specific <code className="text-caption">groupId</code>) can replace the auto-only path later without changing access rules.
        </p>
      </div>
    </main>
  );
}
