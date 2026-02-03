'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { TransportProps } from '../types';

export function Transport({
  isPlaying,
  isPaused,
  currentTime,
  duration,
  onPlay,
  onPause,
  onStop,
  onSeek,
  className = '',
}: TransportProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || isDraggingRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    onSeek(Math.max(0, Math.min(duration, newTime)));
  }, [duration, onSeek]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (isPlaying) {
          onPause();
        } else {
          onPlay();
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onSeek(Math.max(0, currentTime - 2));
        break;
      case 'ArrowRight':
        e.preventDefault();
        onSeek(Math.min(duration, currentTime + 2));
        break;
      case 'm':
        e.preventDefault();
        // Mute toggle would go here
        break;
      case 's':
        e.preventDefault();
        onStop();
        break;
    }
  }, [isPlaying, currentTime, duration, onPlay, onPause, onStop, onSeek]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className={`flex items-center space-x-4 ${className}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Play/Pause Button */}
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="w-10 h-10 bg-emerald hover:bg-emeraldMuted rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald focus:ring-offset-2 focus:ring-offset-bg"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-5 h-5 text-bg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-bg ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Stop Button */}
      <button
        onClick={onStop}
        className="w-8 h-8 text-subtext hover:text-text rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-emerald focus:ring-offset-2 focus:ring-offset-bg"
        aria-label="Stop"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h12v12H6z" />
        </svg>
      </button>

      {/* Time Display */}
      <div className="text-xs text-subtext font-mono min-w-0">
        <span>{formatTime(currentTime)}</span>
        <span className="mx-1">/</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 relative">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="w-full h-2 bg-border rounded-full cursor-pointer hover:h-3 transition-all duration-200"
        >
          <div
            className="h-full bg-gradient-to-r from-emerald to-emeraldMuted rounded-full transition-all duration-200"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        
        {/* Progress Handle */}
        <div
          className="absolute top-1/2 w-4 h-4 bg-emerald rounded-full transform -translate-y-1/2 transition-all duration-200 hover:scale-110"
          style={{ left: `calc(${progressPercentage}% - 8px)` }}
        />
      </div>

      {/* Keyboard Shortcuts Tooltip */}
      <div className="text-xs text-subtext hidden lg:block">
        <span className="hidden sm:inline">Space</span>
        <span className="sm:hidden">▶</span>
        <span className="mx-1">•</span>
        <span className="hidden sm:inline">←→</span>
        <span className="sm:hidden">⏮⏭</span>
      </div>
    </div>
  );
}
