'use client';

import { useState, useCallback, useEffect, type RefObject } from 'react';
import type React from 'react';
import { getApiBaseUrl } from '../../core/api-base';
import { Button } from '../shared/Button';
import type { SandboxReport } from '../../types/sandbox';

export interface SandboxAudioPanelProps {
  displayReport: SandboxReport | null;
  exportId: string | null;
  sandboxAudioSrc: string | null;
  planHash: string | null;
  exportUnavailableReason: { summary: string; step?: string; message?: string } | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  audioGenerateLoading: boolean;
  audioGenerateError: string | null;
  onGenerateAudio: () => void;
}

export function SandboxAudioPanel({
  displayReport,
  exportId,
  sandboxAudioSrc,
  planHash,
  exportUnavailableReason,
  audioRef,
  audioGenerateLoading,
  audioGenerateError,
  onGenerateAudio,
}: SandboxAudioPanelProps) {
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [exportDetailsOpen, setExportDetailsOpen] = useState(false);

  useEffect(() => {
    setDownloadError(null);
    setPlaybackError(null);
  }, [exportId]);

  const handleAudioPlay = useCallback(() => {
    setPlaybackError(null);
    const el = audioRef.current;
    if (!el) return;
    el.play().catch(() => {
      setPlaybackError('Playback blocked by browser. Press Play again or allow audio.');
    });
  }, [audioRef]);

  const handleAudioStop = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaybackError(null);
  }, [audioRef]);

  const handleAudioReplay = useCallback(() => {
    setPlaybackError(null);
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    el.play().catch(() => {
      setPlaybackError('Playback blocked by browser. Press Play again or allow audio.');
    });
  }, [audioRef]);

  const handleDownloadWav = useCallback(async () => {
    if (!exportId) return;
    const base = getApiBaseUrl();
    const url = `${base || ''}/api/exports/${exportId}`;
    setDownloadError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setDownloadError(`Download failed: ${res.status}`);
        return;
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct && !ct.includes('audio') && !ct.includes('wav')) {
        setDownloadError('Download failed: response is not audio (wrong content-type).');
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `astradio-sandbox-${exportId.slice(0, 8)}.wav`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Download failed');
    }
  }, [exportId]);

  if (!displayReport) return null;

  return (
    <div className="mt-6 space-y-2">
      {/* SUBSCRIPTION GATE: Audio generation can be gated by tier here.
          Free tier: text reading only. Premium tier: text + audio.
          For beta: audio CTA is available to all users. */}
      {exportId ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Audio</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleAudioPlay} className="btn-audio">
              Play
            </button>
            <button type="button" onClick={handleAudioStop} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
              Stop
            </button>
            <button type="button" onClick={handleAudioReplay} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
              Restart
            </button>
            <button type="button" onClick={() => void handleDownloadWav()} className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text">
              Download WAV
            </button>
          </div>
          <audio key={exportId} ref={audioRef as React.RefObject<HTMLAudioElement>} src={sandboxAudioSrc ?? undefined} controls className="max-w-full w-full" />
          {playbackError && <p className="text-xs text-red-400">{playbackError}</p>}
          {downloadError && <p className="text-xs text-red-400">{downloadError}</p>}
        </div>
      ) : audioGenerateLoading ? (
        <div className="space-y-2">
          <p className="text-sm text-subtext">Generating audio…</p>
          <Button type="button" variant="audio" size="sm" loading disabled>
            Generating audio…
          </Button>
        </div>
      ) : audioGenerateError ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-600 dark:text-amber-300" role="alert">
            {audioGenerateError}
          </p>
          <Button type="button" variant="audio" size="sm" onClick={() => void onGenerateAudio()}>
            Try again
          </Button>
          {exportUnavailableReason && (exportUnavailableReason.step || exportUnavailableReason.message) && (
            <details className="text-xs text-subtext" open={exportDetailsOpen} onToggle={(e) => setExportDetailsOpen((e.target as HTMLDetailsElement).open)}>
              <summary className="cursor-pointer hover:text-text">Details</summary>
              <pre className="mt-1 p-2 bg-bgElev rounded border border-border/60 overflow-auto">
                {[exportUnavailableReason.step && `step: ${exportUnavailableReason.step}`, exportUnavailableReason.message]
                  .filter(Boolean)
                  .join('\n')}
              </pre>
            </details>
          )}
        </div>
      ) : (
        <Button type="button" variant="audio" size="sm" onClick={() => void onGenerateAudio()}>
          Hear this composition
        </Button>
      )}
      {!exportId && planHash && !audioGenerateLoading && !audioGenerateError && (
        <p className="text-xs text-subtext">
          Plan hash: <code className="text-caption bg-bgElev px-1 py-0.5 rounded border border-border/60">{planHash}</code>
        </p>
      )}
    </div>
  );
}
