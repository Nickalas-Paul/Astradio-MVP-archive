'use client';

import { usePlayerStore } from '../store';
import { Transport } from './Transport';

export function PlayerBar() {
  const { currentTrack, isPlaying, isPaused, currentTime, duration, volume } = usePlayerStore();

  // Don't show player bar if no track is loaded
  if (!currentTrack) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-0/90 backdrop-blur border-t border-border">
      <div className="max-w-content mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Track Info */}
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-violet rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-bg font-bold">♪</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-text-primary truncate">
                Now playing
              </h3>
              <p className="text-xs text-text-secondary">
                {currentTrack.layers.length} layers
              </p>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex-1 max-w-md mx-8">
            <Transport
              isPlaying={isPlaying}
              isPaused={isPaused}
              currentTime={currentTime}
              duration={duration}
              onPlay={() => usePlayerStore.getState().setPlaying(true)}
              onPause={() => usePlayerStore.getState().setPaused(true)}
              onStop={() => usePlayerStore.getState().reset()}
              onSeek={(time) => usePlayerStore.getState().setCurrentTime(time)}
            />
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3 min-w-0 flex-1 justify-end">
            <svg className="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M6.343 6.343a1 1 0 011.414 0L12 10.586l4.243-4.243a1 1 0 111.414 1.414L13.414 12l4.243 4.243a1 1 0 01-1.414 1.414L12 13.414l-4.243 4.243a1 1 0 01-1.414-1.414L10.586 12 6.343 7.757a1 1 0 010-1.414z" />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => usePlayerStore.getState().setVolume(Number(e.target.value))}
              className="w-20 h-1 bg-surface-2 rounded-lg appearance-none cursor-pointer slider"
            />
            <span className="text-xs text-text-secondary w-8">
              {volume}%
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: theme('colors.accent.DEFAULT');
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: theme('colors.accent.DEFAULT');
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
