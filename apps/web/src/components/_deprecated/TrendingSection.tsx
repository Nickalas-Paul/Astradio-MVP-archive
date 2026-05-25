'use client';

import { motion } from 'framer-motion';
import { useTrending } from '../core/social/hooks';
import { isFeatureEnabled } from '../../config/flags';
import { trackPlay, trackLike, trackShare } from '../core/telemetry';

interface TrendingSectionProps {
  genre?: string;
  limit?: number;
  className?: string;
}

export function TrendingSection({ genre, limit = 5, className = '' }: TrendingSectionProps) {
  const { tracks, isLoading, error } = useTrending({ window: '24h', genre });

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_TRENDING')) {
    return null;
  }

  const handlePlay = (compositionId: string) => {
    trackPlay(compositionId, 0);
    // TODO: Implement actual playback
    console.log('Playing trending composition:', compositionId);
  };

  const handleLike = (compositionId: string) => {
    trackLike(compositionId);
    // TODO: Implement actual like functionality
    console.log('Liked composition:', compositionId);
  };

  const handleShare = (compositionId: string) => {
    trackShare(compositionId);
    // TODO: Implement actual share functionality
    console.log('Shared composition:', compositionId);
  };

  if (isLoading) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          {genre ? `${genre.charAt(0).toUpperCase() + genre.slice(1)} Trending` : 'Trending Now'}
        </h3>
        <div className="space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          {genre ? `${genre.charAt(0).toUpperCase() + genre.slice(1)} Trending` : 'Trending Now'}
        </h3>
        <div className="text-center py-8">
          <p className="text-subtext text-sm">Unable to load trending compositions</p>
        </div>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          {genre ? `${genre.charAt(0).toUpperCase() + genre.slice(1)} Trending` : 'Trending Now'}
        </h3>
        <div className="text-center py-8">
          <p className="text-subtext text-sm">No trending compositions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <h3 className="text-lg font-semibold text-text mb-4">
        {genre ? `${genre.charAt(0).toUpperCase() + genre.slice(1)} Trending` : 'Trending Now'}
      </h3>
      
      <div className="space-y-3">
        {tracks.map((item, index) => (
          <motion.div
            key={item.compositionId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center space-x-3 p-3 bg-bgElev rounded-lg border border-border hover:border-emerald/50 transition-colors group"
          >
            {/* Rank */}
            <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-emerald to-violet rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-bg">{index + 1}</span>
            </div>

            {/* Cover */}
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald to-violet rounded-lg flex items-center justify-center">
              {item.coverUrl ? (
                <img 
                  src={item.coverUrl} 
                  alt={item.title}
                  className="w-full h-full rounded-lg object-cover"
                />
              ) : (
                <span className="text-bg font-bold">♪</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-text truncate">
                {item.title}
              </h4>
              <p className="text-xs text-subtext">
                {item.artist || 'Anonymous'} • {item.genre}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-emerald">
                  {item.playCount.toLocaleString()} plays
                </span>
                <span className="text-xs text-subtext">•</span>
                <span className="text-xs text-violet">
                  {item.likeCount} likes
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePlay(item.compositionId)}
                className="p-2 text-subtext hover:text-emerald transition-colors"
                aria-label="Play"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              <button
                onClick={() => handleLike(item.compositionId)}
                className="p-2 text-subtext hover:text-danger transition-colors"
                aria-label="Like"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              
              <button
                onClick={() => handleShare(item.compositionId)}
                className="p-2 text-subtext hover:text-violet transition-colors"
                aria-label="Share"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
