'use client';

import { useState, useCallback, useEffect } from 'react';
import { getApiBaseUrl } from '../../core/api-base';
import { useProfile } from '../../core/social/hooks';
import { canGenerateAudio } from '@/lib/entitlement';
import { Button } from '../shared/Button';
import { useAudioPlayerStore } from '@/store';
import type { SandboxReport } from '../../types/sandbox';

export interface SandboxAudioPanelProps {
  displayReport: SandboxReport | null;
  exportId: string | null;
  exportUnavailableReason: { summary: string; step?: string; message?: string } | null;
  audioGenerateLoading: boolean;
  audioGenerateError: string | null;
  onGenerateAudio: () => void;
  compositionLabel?: string;
  /** Listen flow: large primary audio CTA above the reading. */
  prominent?: boolean;
}

export function SandboxAudioPanel({
  displayReport,
  exportId,
  exportUnavailableReason,
  audioGenerateLoading,
  audioGenerateError,
  onGenerateAudio,
  compositionLabel,
  prominent = false,
}: SandboxAudioPanelProps) {
  const { user } = useProfile();
  const playTrack = useAudioPlayerStore((s) => s.playTrack);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [exportDetailsOpen, setExportDetailsOpen] = useState(false);

  useEffect(() => {
    setDownloadError(null);
  }, [exportId]);

  const handlePlaySoundtrack = useCallback(() => {
    if (!exportId) return;
    playTrack({
      exportId,
      label: compositionLabel?.trim() || 'Sandbox Composition',
      source: 'sandbox',
    });
  }, [exportId, compositionLabel, playTrack]);

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

  const audioButtonClass = prominent
    ? 'text-lg px-8 py-4 w-full sm:w-auto min-h-[52px]'
    : undefined;

  return (
    <div className={prominent ? 'space-y-4' : 'mt-6 space-y-2'}>
      {exportId ? (
        <div className="space-y-3">
          {prominent ? (
            <h2 className="font-serif text-h3 font-semibold text-text-primary text-center sm:text-left">
              Hear this Soundtrack
            </h2>
          ) : (
            <h3 className="text-sm font-semibold text-text-primary">Audio</h3>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={prominent ? 'audio' : 'secondary'}
              size={prominent ? 'md' : 'sm'}
              className={audioButtonClass}
              onClick={handlePlaySoundtrack}
            >
              Hear this Soundtrack
            </Button>
            {!prominent ? (
              <button
                type="button"
                onClick={() => void handleDownloadWav()}
                className="px-3 py-1.5 text-sm rounded-lg border border-border bg-bgElev hover:bg-bgElev/80 text-text-primary"
              >
                Download WAV
              </button>
            ) : null}
          </div>
          {!prominent && downloadError ? <p className="text-xs text-red-400">{downloadError}</p> : null}
        </div>
      ) : audioGenerateLoading ? (
        <div className="space-y-2">
          <p className="text-sm text-text-secondary">Composing audio…</p>
          <Button
            type="button"
            variant={prominent ? 'audio' : 'secondary'}
            size={prominent ? 'md' : 'sm'}
            className={audioButtonClass}
            loading
            disabled
          >
            Composing audio…
          </Button>
        </div>
      ) : audioGenerateError ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-600 dark:text-amber-300" role="alert">
            {audioGenerateError}
          </p>
          <Button
            type="button"
            variant={prominent ? 'audio' : 'secondary'}
            size={prominent ? 'md' : 'sm'}
            className={audioButtonClass}
            onClick={() => void onGenerateAudio()}
          >
            Try again
          </Button>
          {!prominent && exportUnavailableReason && (exportUnavailableReason.step || exportUnavailableReason.message) && (
            <details
              className="text-xs text-text-secondary"
              open={exportDetailsOpen}
              onToggle={(e) => setExportDetailsOpen((e.target as HTMLDetailsElement).open)}
            >
              <summary className="cursor-pointer hover:text-text-primary">Details</summary>
              <pre className="mt-1 p-2 bg-bgElev rounded border border-border/60 overflow-auto">
                {[exportUnavailableReason.step && `step: ${exportUnavailableReason.step}`, exportUnavailableReason.message]
                  .filter(Boolean)
                  .join('\n')}
              </pre>
            </details>
          )}
        </div>
      ) : canGenerateAudio(user) ? (
        // SUBSCRIPTION GATE — swap canGenerateAudio impl at subscription launch
        <Button
          type="button"
          variant={prominent ? 'audio' : 'secondary'}
          size={prominent ? 'md' : 'sm'}
          className={audioButtonClass}
          onClick={() => void onGenerateAudio()}
        >
          Hear this Soundtrack
        </Button>
      ) : null}
    </div>
  );
}
