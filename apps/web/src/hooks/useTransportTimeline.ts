import { useState, useEffect, useRef } from 'react';

export function useTransportTimeline(
  isPlaying: boolean,
  duration: number = 60,
  onSeek?: (seconds: number) => void
) {
  const [seconds, setSeconds] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now - seconds * 1000;
      const elapsed = (now - startRef.current) / 1000;
      const clamped = Math.min(duration, Math.max(0, elapsed));
      setSeconds(clamped);
      if (isPlaying && elapsed < duration + 5) rafRef.current = requestAnimationFrame(tick);
    };
    if (isPlaying) rafRef.current = requestAnimationFrame(tick);
    else startRef.current = null;
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, duration, seconds]);

  useEffect(() => {
    startRef.current = null;
    setSeconds(0);
  }, [duration]);

  const pct = duration > 0 ? Math.min(100, (seconds / duration) * 100) : 0;

  const seek = (s: number) => {
    setIsSeeking(true);
    const clamped = Math.min(duration, Math.max(0, s));
    setSeconds(clamped);
    onSeek?.(clamped);
    setTimeout(() => setIsSeeking(false), 100);
  };

  return { seconds, pct, seek, isSeeking };
}
