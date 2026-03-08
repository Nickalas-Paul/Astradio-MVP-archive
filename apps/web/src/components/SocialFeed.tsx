'use client';

import { motion } from 'framer-motion';
import { useSocialFeed, useSocialActions } from '../core/social/hooks';
import { isFeatureEnabled } from '../core/config/flags';
import { trackFeatureUse } from '../core/telemetry';

interface SocialFeedProps {
  limit?: number;
  className?: string;
}

export function SocialFeed({ limit = 10, className = '' }: SocialFeedProps) {
  const { items, isLoading, error, refresh } = useSocialFeed({});
  const { like, saveTrack } = useSocialActions();

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_SOCIAL')) {
    return null;
  }

  const handleLike = async (itemId: string) => {
    try {
      trackFeatureUse('social', 'like');
      await like(itemId);
    } catch (error) {
      console.error('Failed to like item:', error);
    }
  };

  const handleSave = async (trackId: string) => {
    try {
      trackFeatureUse('social', 'save');
      await saveTrack(trackId);
    } catch (error) {
      console.error('Failed to save track:', error);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'joined':
        return (
          <div className="w-8 h-8 bg-emerald/20 border border-emerald rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
        );
      case 'post':
        return (
          <div className="w-8 h-8 bg-subtext/20 border border-subtext rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </div>
        );
      case 'liked':
        return (
          <div className="w-8 h-8 bg-danger/20 border border-danger rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-danger" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        );
      case 'published':
        return (
          <div className="w-8 h-8 bg-emerald/20 border border-emerald rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-emerald" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        );
      case 'playlist_add':
        return (
          <div className="w-8 h-8 bg-violet/20 border border-violet rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-violet" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        );
      case 'followed':
        return (
          <div className="w-8 h-8 bg-warning/20 border border-warning rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-subtext/20 border border-subtext rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const getActivityText = (item: any) => {
    switch (item.t) {
      case 'joined':
        return (
          <span>
            <strong className="text-text">{item.userName}</strong> joined the community
          </span>
        );
      case 'post':
        return (
          <span>
            <strong className="text-text">{item.userName}</strong> posted in a group
            {item.title ? <span className="text-subtext"> — {item.title}</span> : null}
          </span>
        );
      case 'liked':
        return (
          <span>
            <strong className="text-text">{item.userName}</strong> liked{' '}
            <strong className="text-emerald">{item.compositionTitle}</strong>
          </span>
        );
      case 'published':
        return (
          <span>
            <strong className="text-text">{item.userName}</strong> published{' '}
            <strong className="text-emerald">{item.compositionTitle}</strong>
            <span className="text-subtext"> ({item.genre})</span>
          </span>
        );
      case 'playlist_add':
        return (
          <span>
            <strong className="text-text">{item.userName}</strong> added{' '}
            <strong className="text-emerald">{item.compositionTitle}</strong> to{' '}
            <strong className="text-violet">{item.playlistName}</strong>
          </span>
        );
      case 'followed':
        return (
          <span>
            <strong className="text-text">{item.userName}</strong> started following{' '}
            <strong className="text-warning">{item.targetUserName}</strong>
          </span>
        );
      default:
        return <span>Unknown activity</span>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (isLoading && items.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          Activity Feed
        </h3>
        <div className="space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          Activity Feed
        </h3>
        <div className="text-center py-8">
          <p className="text-subtext text-sm">Unable to load activity feed</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={`card ${className}`}>
        <h3 className="text-lg font-semibold text-text mb-4">
          Activity Feed
        </h3>
        <div className="text-center py-8">
          <p className="text-subtext text-sm">No activity yet</p>
          <p className="text-xs text-subtext mt-1 max-w-sm mx-auto">
            The feed shows posts from groups you join and when new members join the community. Join a group or check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <h3 className="text-lg font-semibold text-text mb-4">
        Activity Feed
      </h3>
      
      <div className="space-y-4">
        {items.map((item, index) => (
          <motion.div
            key={`${item.t}-${item.userId}-${item.at}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start space-x-3 p-3 bg-bgElev rounded-lg border border-border hover:border-emerald/50 transition-colors"
          >
            {/* Activity Icon */}
            {getActivityIcon(item.t)}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text">
                {getActivityText(item)}
              </div>
              <div className="text-xs text-subtext mt-1">
                {formatTimeAgo(item.at)}
              </div>
            </div>

            {/* Actions for compositions */}
            {(item.t === 'liked' || item.t === 'published' || item.t === 'playlist_add') && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleLike(item.compositionId || item.id)}
                  className="p-1 text-subtext hover:text-danger transition-colors"
                  aria-label="Like"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                
                <button
                  onClick={() => handleSave(item.compositionId || item.id)}
                  className="p-1 text-subtext hover:text-violet transition-colors"
                  aria-label="Save"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Load More */}
      {items.length >= limit && (
        <div className="mt-4 text-center">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="btn-secondary text-sm"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      )}
    </div>
  );
}
