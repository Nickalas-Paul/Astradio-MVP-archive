'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiBaseUrl } from '@/core/api-base';
import { getVideoExportUrl } from '@/lib/video/export-video-url';
import { useAudioPlayerStore } from '@/store';

export interface ExportVideoPlayerProps {
  exportId: string;
  /** When true, skip polling and load the video immediately. */
  available?: boolean;
  className?: string;
}

type PlayerState = 'processing' | 'loading' | 'ready' | 'error';

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

type ExportStatusResponse = {
  available?: boolean;
  format?: string | null;
};

export function ExportVideoPlayer({
  exportId,
  available = false,
  className = '',
}: ExportVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>(available ? 'loading' : 'processing');
  const [videoReady, setVideoReady] = useState(available);
  const src = useMemo(
    () => (videoReady ? getVideoExportUrl(exportId) : null),
    [exportId, videoReady],
  );

  useEffect(() => {
    if (available) {
      setVideoReady(true);
      setPlayerState('loading');
      return;
    }

    setVideoReady(false);
    setPlayerState('processing');

    let cancelled = false;
    const started = Date.now();

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - started >= POLL_TIMEOUT_MS) {
        setPlayerState('error');
        return;
      }

      try {
        const base = getApiBaseUrl();
        const r = await fetch(`${base || ''}/api/exports/${exportId}/status`, {
          cache: 'no-store',
        });
        if (!r.ok) return;
        const data = (await r.json()) as ExportStatusResponse;
        if (data.available === true && data.format === 'mp4') {
          setVideoReady(true);
          setPlayerState('loading');
          return;
        }
      } catch {
        /* retry on next interval */
      }

      if (!cancelled) {
        window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [available, exportId]);

  const handleLoadedMetadata = useCallback(() => {
    setPlayerState('ready');
  }, []);

  const handleError = useCallback(() => {
    setPlayerState('error');
  }, []);

  const handlePlay = useCallback(() => {
    useAudioPlayerStore.getState()._setIsPlaying(false);
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border bg-surface-1 shadow-soft ${className}`.trim()}
      style={{ maxHeight: 500 }}
    >
      {playerState === 'processing' ? (
        <div className="flex aspect-[9/16] max-h-[500px] w-full flex-col items-center justify-center gap-3 px-4">
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-2" aria-hidden="true" />
          <p className="text-sm text-text-muted">Composing video…</p>
        </div>
      ) : null}

      {playerState === 'loading' && videoReady ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-surface-1"
          aria-hidden="true"
        >
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface-2" />
        </div>
      ) : null}

      {playerState === 'error' ? (
        <div className="flex aspect-[9/16] max-h-[500px] w-full items-center justify-center px-4">
          <p className="text-sm text-text-muted">Video unavailable</p>
        </div>
      ) : null}

      {videoReady && src && playerState !== 'error' && playerState !== 'processing' ? (
        <video
          ref={videoRef}
          key={src}
          src={src}
          controls
          playsInline
          preload="metadata"
          className="mx-auto block max-h-[500px] w-auto max-w-full bg-surface-1"
          style={{ aspectRatio: '9 / 16' }}
          onLoadedMetadata={handleLoadedMetadata}
          onError={handleError}
          onPlay={handlePlay}
        />
      ) : null}
    </div>
  );
}
