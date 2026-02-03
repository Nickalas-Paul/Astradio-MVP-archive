import { useCallback, useEffect, useRef } from 'react';
import { useCompositionStore } from '../store';
import { createComposition, subscribeToJob, playComposition, stopComposition } from '../core/api/engine-adapter';
import { trackGenerate, trackError } from '../core/telemetry';
import type { CompositionRequest, CompositionStatus } from '../types';

export interface UseCompositionJobReturn {
  stage: CompositionStatus['stage'] | 'idle';
  pct: number;
  audioUrl?: string;
  layers?: Array<{ key: string; gain: number }>;
  error?: string;
  cancel: () => void;
  start: (request: CompositionRequest) => Promise<void>;
  isGenerating: boolean;
}

export function useCompositionJob(): UseCompositionJobReturn {
  const { currentJob, setCurrentJob, updateJobStatus, addJobToHistory } = useCompositionStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (currentJob) {
      updateJobStatus(currentJob.id, {
        stage: 'error',
        code: 'CANCELLED',
        message: 'Composition cancelled by user',
      });
    }
  }, [currentJob, updateJobStatus]);

  const start = useCallback(async (request: CompositionRequest) => {
    // Cancel any existing job
    cancel();

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Create new job
    const jobId = Math.random().toString(36).substr(2, 9);
    const newJob = {
      id: jobId,
      request,
      status: { stage: 'queued' as const, pct: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setCurrentJob(newJob);

    try {
      // Track generation start
      trackGenerate(request.genre, request.durationSec);

      // Use adapter layer to create composition
      const { jobId: adapterJobId } = await createComposition(request);

      // Subscribe to job updates
      const unsubscribe = subscribeToJob(adapterJobId, (update) => {
        updateJobStatus(jobId, update);

        // If job completed successfully, add to history
        if (update.stage === 'ready') {
          addJobToHistory({
            ...newJob,
            status: update,
          });
        }
      });

      // Store unsubscribe function for cleanup
      abortControllerRef.current = {
        abort: () => {
          unsubscribe();
          abortControllerRef.current = null;
        }
      } as any;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Job was cancelled, don't update status
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      trackError('COMPOSITION_FAILED', errorMessage);
      updateJobStatus(jobId, {
        stage: 'error',
        code: 'COMPOSITION_FAILED',
        message: errorMessage,
      });
    }
  }, [cancel, setCurrentJob, updateJobStatus, addJobToHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Extract current status
  const stage = currentJob?.status.stage || 'idle';
const st = currentJob?.status;
  const pct = st && 'pct' in st ? st.pct : 0;
  const audioUrl = st && 'url' in st ? (st as { url: string }).url : undefined;
  const layers = st && 'layers' in st ? (st as { layers: Array<{ key: string; gain: number }> }).layers : undefined;
  const error = st && 'message' in st ? (st as { message: string }).message : undefined;
  const isGenerating = stage === 'queued' || stage === 'preparing' || stage === 'generating' || stage === 'mixing';

  return {
    stage,
    pct,
    audioUrl,
    layers,
    error,
    cancel,
    start,
    isGenerating,
  };
}
