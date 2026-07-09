'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { getVideoExportUrl } from '@/lib/video/export-video-url';
import { useAudioPlayerStore } from '@/store';

export interface ExportVideoPlayerProps {
  exportId: string;
  className?: string;
}

type PlayerState = 'loading' | 'ready' | 'error';

export function ExportVideoPlayer({ exportId, className = '' }: ExportVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const src = useMemo(() => getVideoExportUrl(exportId), [exportId]);

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
      {playerState === 'loading' ? (
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
      ) : (
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
      )}
    </div>
  );
}
