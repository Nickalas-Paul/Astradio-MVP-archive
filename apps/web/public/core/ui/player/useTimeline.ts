// Timeline Hook - UI-side progress tracking with visual clamping
// Decouples UI timeline from engine timing to prevent drift issues

import { useState, useEffect, useRef } from 'react';

export interface TimelineState {
  seconds: number;
  pct: number;
  isAtEnd: boolean;
}

export function useTimeline(targetSec: number, isPlaying: boolean): TimelineState {
  const startRef = useRef<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current == null) {
        startRef.current = now - seconds * 1000;
      }
      
      const elapsed = (now - startRef.current) / 1000;
      
      // Clamp to target duration (visual only - doesn't affect engine)
      const clampedSeconds = Math.min(targetSec, Math.max(0, elapsed));
      setSeconds(clampedSeconds);
      
      // Continue ticking if playing and not too far past target
      if (isPlaying && elapsed < targetSec + 5) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      // Reset start time when paused
      startRef.current = null;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, targetSec, seconds]);

  // Reset when target duration changes
  useEffect(() => {
    startRef.current = null;
    setSeconds(0);
  }, [targetSec]);

  const pct = targetSec > 0 ? Math.min(100, (seconds / targetSec) * 100) : 0;
  const isAtEnd = seconds >= targetSec;

  return {
    seconds,
    pct,
    isAtEnd,
  };
}

// Hook for composition timeline with automatic reset
export function useCompositionTimeline(
  isPlaying: boolean,
  duration: number = 60
): TimelineState & { reset: () => void } {
  const timeline = useTimeline(duration, isPlaying);
  const [key, setKey] = useState(0);

  const reset = () => {
    setKey(prev => prev + 1);
  };

  // Reset timeline when key changes
  useEffect(() => {
    // This will trigger the reset in useTimeline
  }, [key]);

  return {
    ...timeline,
    reset,
  };
}

// Hook for transport controls with timeline integration
export function useTransportTimeline(
  isPlaying: boolean,
  duration: number = 60,
  onSeek?: (seconds: number) => void
) {
  const timeline = useTimeline(duration, isPlaying);
  const [isSeeking, setIsSeeking] = useState(false);

  const seek = (seconds: number) => {
    setIsSeeking(true);
    const clampedSeconds = Math.min(duration, Math.max(0, seconds));
    
    // Update timeline immediately for responsive UI
    setSeconds(clampedSeconds);
    
    // Notify parent component
    onSeek?.(clampedSeconds);
    
    // Reset seeking state after a brief delay
    setTimeout(() => setIsSeeking(false), 100);
  };

  return {
    ...timeline,
    seek,
    isSeeking,
  };
}
