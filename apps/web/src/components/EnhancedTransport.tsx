'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useUIStore } from '../store';
import { useTransportTimeline } from '../hooks/useTransportTimeline';
import { playComposition, stopComposition } from '../core/api/engine-adapter';
import { trackPlay, trackError } from '../core/telemetry';
import { getPlayableLyriaUrl } from '../core/audio/lyria-playback';

interface EnhancedTransportProps {
  audioUrl: string;
  compositionId?: string;
  duration?: number;
  className?: string;
}

export function EnhancedTransport({ 
  audioUrl, 
  compositionId,
  duration = 60, 
  className = '' 
}: EnhancedTransportProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { addToast } = useUIStore();

  const resolvedLyriaUrl = useMemo(() => {
    if (!audioUrl) return null;
    try {
      return getPlayableLyriaUrl({ url: audioUrl });
    } catch {
      return null;
    }
  }, [audioUrl]);

  // Use timeline hook for UI-side progress tracking
  const { seconds, pct, seek, isSeeking } = useTransportTimeline(
    isPlaying,
    duration,
    (newTime) => {
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
      }
    }
  );

  // Initialize audio element (Lyria-only URL)
  useEffect(() => {
    if (!resolvedLyriaUrl) {
      if (audioRef.current) {
        audioRef.current.src = '';
        audioRef.current = null;
      }
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(resolvedLyriaUrl);
      audioRef.current.preload = 'auto';
      audioRef.current.volume = volume;

      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
        if (compositionId) {
          trackPlay(compositionId, duration * 1000);
        }
      });

      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio error:', e);
        trackError('AUDIO_PLAYBACK_ERROR', 'Audio element failed to play');
        addToast({ type: 'error', title: 'Audio playback error', message: 'Audio unavailable (Lyria-only).' });
        setIsPlaying(false);
      });
    } else if (audioRef.current.src !== resolvedLyriaUrl) {
      audioRef.current.src = resolvedLyriaUrl;
      audioRef.current.load();
      setIsPlaying(false);
    }
  }, [resolvedLyriaUrl, volume, compositionId, duration, addToast]);

  const play = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        
        // Track play start
        if (compositionId) {
          trackPlay(compositionId, 0);
        }
        
        // Notify engine adapter
        if (compositionId) {
          await playComposition(compositionId);
        }
        
        addToast({ type: 'info', title: 'Playing track...', duration: 2000 });
      } catch (error) {
        console.error('Failed to play audio:', error);
        trackError('AUDIO_PLAY_FAILED', 'User interaction required or audio blocked');
        addToast({ type: 'error', title: 'Play failed', message: 'User interaction might be required.' });
      }
    }
  }, [compositionId, addToast]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      addToast({ type: 'info', title: 'Track paused.', duration: 2000 });
    }
  }, [addToast]);

  const stop = useCallback(async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      
      // Notify engine adapter
      if (compositionId) {
        await stopComposition(compositionId);
      }
      
      addToast({ type: 'info', title: 'Track stopped.', duration: 2000 });
    }
  }, [compositionId, addToast]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    
    const timeline = e.currentTarget;
    const clickX = e.clientX - timeline.getBoundingClientRect().left;
    const newTime = (clickX / timeline.offsetWidth) * duration;
    seek(newTime);
  }, [duration, seek]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        isPlaying ? pause() : play();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        seek(Math.max(0, seconds - 2));
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        seek(Math.min(duration, seconds + 2));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, play, pause, seek, seconds, duration]);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={isPlaying ? pause : play}
            className="p-2 rounded-full bg-emerald text-bg hover:bg-emeraldMuted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={stop}
            className="p-2 rounded-full bg-panel text-subtext hover:bg-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
            aria-label="Stop"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
          </motion.button>
        </div>

        <div className="flex-1 text-center text-sm font-medium text-subtext">
          {formatTime(seconds)} / {formatTime(duration)}
        </div>

        <div className="w-16 text-right text-sm font-medium text-emerald">
          {pct.toFixed(0)}%
        </div>
      </div>

      <motion.div
        className="w-full h-2 bg-border rounded-full cursor-pointer overflow-hidden"
        onClick={handleSeek}
        whileHover={{ scaleY: 1.2 }}
        transition={{ duration: 0.1 }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Playback progress"
      >
        <motion.div
          className="h-full bg-violet rounded-full"
          style={{ width: `${pct}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      </motion.div>

      {/* Volume control */}
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M6 8h4l5-5v18l-5-5H6a2 2 0 01-2-2V10a2 2 0 012-2z" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => {
            const newVolume = parseFloat(e.target.value);
            setVolume(newVolume);
            if (audioRef.current) {
              audioRef.current.volume = newVolume;
            }
          }}
          className="flex-1 h-2 bg-border rounded-full appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-emerald [&::-webkit-slider-thumb]:appearance-none
                      [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-emerald [&::-moz-range-thumb]:border-0"
        />
        <span className="w-8 text-xs text-subtext">
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  );
}
