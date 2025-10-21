import type { CompositionRequest, CompositionStatus } from '../../types';

type JobUpdate = (update: CompositionStatus) => void;

const listeners = new Map<string, JobUpdate>();

export async function createComposition(req: CompositionRequest): Promise<{ jobId: string }> {
  // Deterministic job id for audit repeatability
  const base = `${req.chartA}-${req.chartB || ''}-${req.genre}-${req.durationSec}-${req.seed || 'noseed'}-${req.controlHash || 'nohash'}`;
  const jobId = `job_${btoa(base).replace(/=+/g, '')}`;
  // Simulate async updates
  setTimeout(() => listeners.get(jobId)?.({ stage: 'preparing', pct: 10 }), 50);
  setTimeout(() => listeners.get(jobId)?.({ stage: 'generating', pct: 50 }), 120);
  setTimeout(() => listeners.get(jobId)?.({ stage: 'mixing', pct: 85 }), 220);
  setTimeout(() => listeners.get(jobId)?.({
    stage: 'ready',
    id: jobId,
    url: `/media/${jobId}.mp3`,
    layers: [
      { key: 'melody', gain: 0.8 },
      { key: 'harmony', gain: 0.7 },
      { key: 'rhythm', gain: 0.75 },
      { key: 'texture', gain: 0.6 },
    ],
    audioHash: jobId, // deterministic placeholder
  }), 400);
  return { jobId };
}

export function subscribeToJob(jobId: string, onUpdate: JobUpdate): () => void {
  listeners.set(jobId, onUpdate);
  return () => listeners.delete(jobId);
}

export async function playComposition(id: string) {
  return true;
}

export async function stopComposition(id: string) {
  return true;
}


