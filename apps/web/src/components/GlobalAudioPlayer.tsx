'use client';

import { useEffect, useRef, type MouseEvent } from 'react';
import { resolveExportUrl } from '../lib/audio/export-audio-cache';
import {
  createMediaElementAnalyser,
  resumeAudioContext,
  type MediaElementAnalyserBundle,
} from '../lib/audio/media-element-analyser';
import { useAudioPlayerStore, type AudioSource } from '../store/audio-player';

function sourceLabel(source: AudioSource): string {
  const labels: Record<AudioSource, string> = {
    identity: 'Identity',
    transit: 'Transit',
    sky: 'Sky',
    connection: 'Connection',
    sandbox: 'Sandbox',
    forecast: 'Forecast',
    post: 'Post',
    dm: 'Message',
  };
  return labels[source] ?? source;
}

export function GlobalAudioPlayer() {
  const currentTrack = useAudioPlayerStore((s) => s.currentTrack);
  const isPlaying = useAudioPlayerStore((s) => s.isPlaying);
  const isLoading = useAudioPlayerStore((s) => s.isLoading);
  const currentTime = useAudioPlayerStore((s) => s.currentTime);
  const duration = useAudioPlayerStore((s) => s.duration);
  const volume = useAudioPlayerStore((s) => s.volume);
  const error = useAudioPlayerStore((s) => s.error);
  const stop = useAudioPlayerStore((s) => s.stop);
  const togglePlayPause = useAudioPlayerStore((s) => s.togglePlayPause);
  const seek = useAudioPlayerStore((s) => s.seek);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserBundleRef = useRef<MediaElementAnalyserBundle | null>(null);
  const loadingExportIdRef = useRef<string | null>(null);
  const lastStatusTimeRef = useRef(0);
  const seekInProgressRef = useRef(false);

  const ensureAnalyser = (audio: HTMLAudioElement) => {
    if (analyserBundleRef.current) return analyserBundleRef.current;
    const bundle = createMediaElementAnalyser(audio);
    if (!bundle) return null;
    analyserBundleRef.current = bundle;
    useAudioPlayerStore.getState()._setAudioContext(bundle.context);
    useAudioPlayerStore.getState()._setAnalyserNode(bundle.analyser);
    return bundle;
  };

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (seekInProgressRef.current) return;
      lastStatusTimeRef.current = audio.currentTime;
      useAudioPlayerStore.getState()._setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      useAudioPlayerStore.getState()._setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const onEnded = () => {
      useAudioPlayerStore.getState()._setIsPlaying(false);
      useAudioPlayerStore.getState()._setCurrentTime(0);
      lastStatusTimeRef.current = 0;
    };

    const onError = () => {
      const el = audioRef.current;
      if (el && !el.paused && el.currentTime > 0) return;
      useAudioPlayerStore.getState()._setError('Playback failed');
    };

    const onPause = () => {
      useAudioPlayerStore.getState()._setIsPlaying(false);
    };

    const onPlay = () => {
      useAudioPlayerStore.getState()._setIsPlaying(true);
      useAudioPlayerStore.getState()._setError(null);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('play', onPlay);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('play', onPlay);
      audio.src = '';
      audioRef.current = null;
      const bundle = analyserBundleRef.current;
      analyserBundleRef.current = null;
      useAudioPlayerStore.getState()._setAnalyserNode(null);
      useAudioPlayerStore.getState()._setAudioContext(null);
      if (bundle) {
        try {
          bundle.source.disconnect();
          bundle.analyser.disconnect();
          void bundle.context.close();
        } catch {
          // ignore teardown errors
        }
      }
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  useEffect(() => {
    const exportId = currentTrack?.exportId ?? null;
    loadingExportIdRef.current = exportId;

    if (!exportId) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    let cancelled = false;

    void (async () => {
      useAudioPlayerStore.getState()._setIsLoading(true);
      useAudioPlayerStore.getState()._setError(null);

      try {
        const url = await resolveExportUrl(exportId);
        if (cancelled || loadingExportIdRef.current !== exportId) return;

        audio.volume = Math.max(0, Math.min(1, useAudioPlayerStore.getState().volume));
        // Wire analyser once before first play (MediaElementSource may only be created once).
        const bundle = ensureAnalyser(audio);
        if (bundle) await resumeAudioContext(bundle.context);

        audio.src = url;
        audio.load();

        useAudioPlayerStore.getState()._setResolvedUrl(url);
        useAudioPlayerStore.getState()._setIsLoading(false);

        await audio.play();
        if (cancelled || loadingExportIdRef.current !== exportId) return;
        useAudioPlayerStore.getState()._setIsPlaying(true);
      } catch {
        if (!cancelled && loadingExportIdRef.current === exportId) {
          useAudioPlayerStore.getState()._setError('Could not load audio');
          useAudioPlayerStore.getState()._setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.exportId]);

  useEffect(() => {
    if (isLoading || !currentTrack || !audioRef.current) return;
    const audio = audioRef.current;

    void (async () => {
      try {
        if (isPlaying) {
          const bundle = ensureAnalyser(audio);
          if (bundle) await resumeAudioContext(bundle.context);
          if (audio.paused) {
            await audio.play();
          }
        } else if (!audio.paused) {
          audio.pause();
        }
      } catch {
        useAudioPlayerStore.getState()._setError('Playback failed');
      }
    })();
  }, [isPlaying, isLoading, currentTrack]);

  useEffect(() => {
    if (isLoading || !audioRef.current) return;
    if (Math.abs(currentTime - lastStatusTimeRef.current) < 0.25) return;

    const audio = audioRef.current;
    seekInProgressRef.current = true;

    void (async () => {
      try {
        audio.currentTime = currentTime;
        lastStatusTimeRef.current = currentTime;
      } catch {
        useAudioPlayerStore.getState()._setError('Playback failed');
      } finally {
        seekInProgressRef.current = false;
      }
    })();
  }, [currentTime, isLoading]);

  if (!currentTrack) {
    return null;
  }

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const handleProgressClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!duration || duration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface-0/95 backdrop-blur">
      <div className="h-1 w-full bg-border" aria-hidden>
        <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{currentTrack.label}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="rounded bg-bgElev px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {sourceLabel(currentTrack.source)}
            </span>
            {error ? (
              <span className="truncate text-xs text-amber-600 dark:text-amber-300">{error}</span>
            ) : null}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void useAudioPlayerStore.getState().resumeAnalyserContext();
              togglePlayPause();
            }}
            disabled={isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-bg transition-colors hover:bg-accent-hover disabled:opacity-60"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoading ? (
              <span className="text-xs">…</span>
            ) : isPlaying ? (
              <span aria-hidden className="text-sm leading-none">
                ❚❚
              </span>
            ) : (
              <span aria-hidden className="ml-0.5 text-sm leading-none">
                ▶
              </span>
            )}
          </button>

          <div
            role="slider"
            aria-label="Playback progress"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            className="h-1.5 min-w-0 flex-1 cursor-pointer rounded-full bg-border"
            onClick={handleProgressClick}
          >
            <div className="h-full rounded-full bg-accent/80 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => stop()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bgElev hover:text-text-primary"
          aria-label="Stop"
        >
          ×
        </button>
      </div>
    </div>
  );
}
