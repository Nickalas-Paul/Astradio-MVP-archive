'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  composeCampaignDaily,
  extractResolveMeta,
  fetchGameEncounter,
  todayIsoLocal,
  nowTimeLocal,
  GameApiError,
  type DailyResolveMeta,
  type EncounterResponse,
} from '@/lib/game-api';

export function useGameEncounter(campaignId: string) {
  const [encounter, setEncounter] = useState<EncounterResponse | null>(null);
  const [resolveMeta, setResolveMeta] = useState<DailyResolveMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEncounter = useCallback(async () => {
    return fetchGameEncounter(campaignId, { date: todayIsoLocal() });
  }, [campaignId]);

  const composeAndLoad = useCallback(async () => {
    setComposing(true);
    try {
      const daily = await composeCampaignDaily(campaignId, {
        date: todayIsoLocal(),
        time: nowTimeLocal(),
      });
      setResolveMeta(extractResolveMeta(daily));
      const data = await fetchEncounter();
      setEncounter(data);
      return data;
    } finally {
      setComposing(false);
    }
  }, [campaignId, fetchEncounter]);

  const compose = useCallback(async () => {
    setError(null);
    try {
      await composeAndLoad();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compose daily');
      throw e;
    }
  }, [composeAndLoad]);

  const refresh = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setError(null);
    try {
      // Always compose/fetch daily meta so resolve tokens are available.
      await composeAndLoad();
    } catch (e) {
      if (e instanceof GameApiError && (e.status === 404 || e.code === 'DAILY_REQUIRED')) {
        try {
          await composeAndLoad();
        } catch (composeErr) {
          setError(
            composeErr instanceof Error ? composeErr.message : 'Failed to compose daily encounter'
          );
          setEncounter(null);
        }
      } else {
        // Encounter may still load if compose failed for unrelated reasons — try encounter alone.
        try {
          const data = await fetchEncounter();
          setEncounter(data);
        } catch (encErr) {
          setError(encErr instanceof Error ? encErr.message : 'Failed to load encounter');
          setEncounter(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId, composeAndLoad, fetchEncounter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    encounter,
    resolveMeta,
    loading,
    error,
    composing,
    resolved: !!encounter?.resolved,
    resolution: encounter?.resolution ?? null,
    compose,
    refresh,
    setEncounter,
  };
}
