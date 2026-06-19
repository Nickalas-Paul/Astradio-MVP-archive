import { useCallback, useEffect, useState } from 'react';
import {
  fetchChartSnapshot,
  fetchCompositionDetail,
  fetchSavedCompositions,
  postSnapshot,
} from '../lib/sandbox-fetch';
import { snapshotFromEphemeris } from '../lib/sandbox-slot-utils';
import { useAuthStore } from '../store/auth';
import { useSandboxStore } from '../store/sandbox';

export function useSandboxData() {
  const userId = useAuthStore((s) => s.user?.id);
  const loadCompositionToStore = useSandboxStore((s) => s.loadComposition);
  const updateSlot = useSandboxStore((s) => s.updateSlot);

  const [savedCompositions, setSavedCompositions] = useState<
    Awaited<ReturnType<typeof fetchSavedCompositions>>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingCompositionId, setLoadingCompositionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSavedCompositions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSavedCompositions(userId);
      setSavedCompositions(rows);
    } catch (e) {
      setSavedCompositions([]);
      setError(e instanceof Error ? e.message : 'Failed to load saved compositions');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hydrateSlotSnapshots = useCallback(
    async (slots: ReturnType<typeof useSandboxStore.getState>['slots']) => {
      if (!userId) return;
      await Promise.all(
        slots.map(async (slot, index) => {
          try {
            if (slot.chartId) {
              const snap = await fetchChartSnapshot(slot.chartId);
              if (snap) {
                updateSlot(index, { snapshot: snapshotFromEphemeris(snap) });
              }
              return;
            }
            if (
              slot.birth &&
              slot.birth.lat != null &&
              slot.birth.lon != null &&
              Number.isFinite(slot.birth.lat) &&
              Number.isFinite(slot.birth.lon)
            ) {
              const overrides = Object.fromEntries(
                Object.entries(slot.overrides ?? {}).map(([k, v]) => [k, { lonDeg: v.lon }])
              );
              const res = await postSnapshot(
                {
                  date: slot.birth.date,
                  time: slot.birth.time,
                  lat: slot.birth.lat,
                  lon: slot.birth.lon,
                  tz: slot.birth.timezone,
                  houseSystem: 'placidus',
                },
                { planets: overrides }
              );
              if (res.snapshot) {
                updateSlot(index, { snapshot: snapshotFromEphemeris(res.snapshot) });
              }
            }
          } catch {
            /* best-effort preview hydration */
          }
        })
      );
    },
    [updateSlot, userId]
  );

  const loadComposition = useCallback(
    async (id: string) => {
      if (!userId) {
        setLoadError('Sign in to load saved compositions.');
        return;
      }
      setLoadingCompositionId(id);
      setLoadError(null);
      try {
        const detail = await fetchCompositionDetail(id, userId);
        loadCompositionToStore(detail);
        const slots = useSandboxStore.getState().slots;
        await hydrateSlotSnapshots(slots);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load composition');
      } finally {
        setLoadingCompositionId(null);
      }
    },
    [hydrateSlotSnapshots, loadCompositionToStore, userId]
  );

  return {
    savedCompositions,
    loading,
    error,
    loadError,
    loadingCompositionId,
    refresh,
    loadComposition,
  };
}
