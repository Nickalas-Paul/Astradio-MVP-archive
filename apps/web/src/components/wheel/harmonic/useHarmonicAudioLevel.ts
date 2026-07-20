'use client';

import { useRef } from 'react';
import {
  breathingAudioLevel,
  readBassWeightedLevel,
} from '../../../lib/audio/media-element-analyser';
import { useAudioPlayerStore } from '../../../store/audio-player';

/**
 * Sample FFT (or breathing fallback) once per frame.
 * FFT only when playing and track matches linkedExportId (when set).
 * Store `audioAnalyserLevel` is throttled — scene reads analyser directly each frame.
 */
export function useHarmonicAudioLevelSampler(linkedExportId: string | null | undefined) {
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const lastStoreWriteRef = useRef(0);

  return (elapsed: number, reducedMotion: boolean): number => {
    if (reducedMotion) return 0.5;

    const { analyserNode, isPlaying, currentTrack, _setAudioAnalyserLevel } =
      useAudioPlayerStore.getState();
    const trackMatches =
      !linkedExportId || currentTrack?.exportId === linkedExportId;

    let level: number;
    if (analyserNode && isPlaying && trackMatches) {
      const bins = analyserNode.frequencyBinCount;
      if (!dataArrayRef.current || dataArrayRef.current.length !== bins) {
        dataArrayRef.current = new Uint8Array(bins);
      }
      level = readBassWeightedLevel(analyserNode, dataArrayRef.current);
    } else {
      level = breathingAudioLevel(elapsed);
    }

    const now = typeof performance !== 'undefined' ? performance.now() : elapsed * 1000;
    if (now - lastStoreWriteRef.current > 100) {
      lastStoreWriteRef.current = now;
      _setAudioAnalyserLevel(level);
    }

    return level;
  };
}
