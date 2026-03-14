'use client';

import { useEffect } from 'react';
import { useCompositionStore } from '../store';
import { getApiBaseUrl } from '../core/api-base';

/**
 * Re-fetches audio for composition jobs that have exportId but lost their blob URL
 * (e.g. after refresh). Shared by Profile and Community so both surfaces hydrate
 * from the same composition history.
 */
export function useHydrateCompositionUrls(): void {
  const jobHistory = useCompositionStore((s) => s.jobHistory);

  useEffect(() => {
    const t = setTimeout(() => {
      const state = useCompositionStore.getState();
      const jobs = state.jobHistory.filter(
        (j) =>
          j.status.stage === 'ready' &&
          j.exportId &&
          (!(j.status.url && j.status.url.length > 0))
      );
      const base = getApiBaseUrl();
      jobs.forEach((job) => {
        const exportId = job.exportId;
        if (!exportId) return;
        fetch(`${base || ''}/api/exports/${exportId}`, { credentials: 'same-origin' })
          .then((res) => (res.ok ? res.arrayBuffer() : null))
          .then((ab) => {
            if (ab && ab.byteLength > 0) {
              const current = useCompositionStore.getState().jobHistory.find((j) => j.id === job.id);
              if (current?.status.stage === 'ready') {
                const blob = new Blob([ab], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                useCompositionStore.getState().updateJobStatus(job.id, {
                  stage: 'ready',
                  id: current.status.id,
                  url,
                  layers: current.status.layers,
                });
              }
            }
          })
          .catch(() => {});
      });
    }, 150);
    return () => clearTimeout(t);
  }, [jobHistory.length]);
}
