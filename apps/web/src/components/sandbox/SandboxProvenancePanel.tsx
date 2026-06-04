'use client';

import { useState, useCallback, useEffect } from 'react';
import type { SandboxResolvedSession } from '../../types/sandbox';

export interface SandboxProvenancePanelProps {
  lastResolve: SandboxResolvedSession | null;
  planHash: string | null;
  lastCombinedHashUsed: string | null;
  exportId: string | null;
  onExportJson: () => void;
  onReplay: () => Promise<'match' | 'mismatch'>;
}

export function SandboxProvenancePanel({
  lastResolve,
  planHash,
  lastCombinedHashUsed,
  exportId,
  onExportJson,
  onReplay,
}: SandboxProvenancePanelProps) {
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayStatus, setReplayStatus] = useState<'idle' | 'match' | 'mismatch' | 'error'>('idle');
  const [replayError, setReplayError] = useState<string | null>(null);

  const replayNeedsSnapshot = Boolean(
    lastResolve?.source === 'live_resolve' &&
      lastResolve.lastSubmittedResolveBody &&
      lastResolve.planSha256,
  );

  useEffect(() => {
    setReplayStatus('idle');
    setReplayError(null);
  }, [planHash]);

  const handleReplayClick = useCallback(async () => {
    setReplayLoading(true);
    setReplayError(null);
    setReplayStatus('idle');
    try {
      const result = await onReplay();
      setReplayStatus(result);
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : 'Replay failed');
      setReplayStatus('error');
    } finally {
      setReplayLoading(false);
    }
  }, [onReplay]);

  return (
    <details className="mt-6 border-t border-border/60 pt-4 text-xs text-text-secondary space-y-3 group">
      <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-2 text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden">
        <span className="font-semibold text-text-primary">Provenance &amp; debug replay</span>
        <span className="text-caption uppercase tracking-wide text-text-secondary/90 group-open:hidden">Show secondary tools</span>
        <span className="text-caption uppercase tracking-wide text-text-secondary/90 hidden group-open:inline">Hide</span>
      </summary>
      <p className="mt-2 text-xs text-text-secondary">
        Secondary only: export the last bundle or replay the <span className="font-medium text-text-primary">exact JSON</span> from the previous resolve. This is not a second
        Generate and does <span className="font-medium text-text-primary">not</span> use your current wheel—use{' '}
        <span className="font-medium text-text-primary">Generate from current composition</span> for that.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <button onClick={onExportJson} className="px-3 py-1.5 text-xs rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text-primary">
          Export JSON
        </button>
        <button
          onClick={() => void handleReplayClick()}
          disabled={replayLoading || !replayNeedsSnapshot}
          className="px-3 py-1.5 text-xs rounded-lg border border-dashed border-border/80 bg-bgElev/60 hover:bg-bgElev/80 disabled:opacity-50 disabled:cursor-not-allowed text-text-secondary"
        >
          {replayLoading ? 'Replaying…' : 'Replay last resolve payload'}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <span className="font-semibold">combinedHash:</span>{' '}
          {lastCombinedHashUsed ? (
            <code className="text-caption bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">{lastCombinedHashUsed}</code>
          ) : (
            <span>—</span>
          )}
        </div>
        <div>
          <span className="font-semibold">plan_sha256:</span>{' '}
          {planHash ? (
            <code className="text-caption bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">{planHash}</code>
          ) : (
            <span>—</span>
          )}
        </div>
        <div>
          <span className="font-semibold">export_id:</span>{' '}
          {exportId ? (
            <code className="text-caption bg-bgElev px-1 py-0.5 rounded border border-border/60 break-all">{exportId}</code>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
      {replayStatus === 'mismatch' && <p className="text-xs font-semibold text-red-400">Determinism mismatch</p>}
      {replayStatus === 'match' && <p className="text-xs text-accent-light">Replay matched plan hash.</p>}
      {replayStatus === 'error' && replayError && <p className="text-xs text-red-400">{replayError}</p>}
    </details>
  );
}
