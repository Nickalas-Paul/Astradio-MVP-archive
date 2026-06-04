'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLibrary, usePlaylists, useFavorites } from '../../core/social/hooks';
import { isFeatureEnabled } from '../../core/config/flags';
import { trackFeatureUse } from '../../core/telemetry';
import type { LibraryItem, Playlist } from '../../core/social/types';

export default function LibraryPanel() {
  const { items, addItem, loading: libraryLoading, error: libraryError } = useLibrary();
  const { lists, save, loading: playlistsLoading, error: playlistsError } = usePlaylists();
  const { favs, toggle, isFavorited, loading: favoritesLoading, error: favoritesError } = useFavorites();
  
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_SOCIAL')) {
    return null;
  }

  const handleToggleFavorite = async (item: LibraryItem) => {
    trackFeatureUse('library', 'toggle_favorite');
    await toggle((item as any).id, item.t);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistTitle.trim()) return;
    
    trackFeatureUse('library', 'create_playlist');
    
    const newPlaylist: Playlist = {
      id: `pl_${Date.now()}`,
      ownerId: 'u_me',
      title: newPlaylistTitle.trim(),
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      await save(newPlaylist);
      setNewPlaylistTitle('');
      setIsCreatingPlaylist(false);
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  const getItemTitle = (item: LibraryItem) => {
    if (item.t === 'composition') return item.title;
    if (item.t === 'pair') return item.label;
    if (item.t === 'chart') return item.label;
    return 'Unknown';
  };

  const getItemSubtitle = (item: LibraryItem) => {
    if (item.t === 'composition') return `${item.genre} • ${item.durationSec}s`;
    if (item.t === 'pair') return 'Chart Pair';
    if (item.t === 'chart') return 'Chart';
    return '';
  };

  const getItemIcon = (item: LibraryItem) => {
    if (item.t === 'composition') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    } else if (item.t === 'pair') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
  };

  if (libraryLoading || playlistsLoading || favoritesLoading) {
    return (
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">Your Library</h3>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-text-primary">Playlists</h3>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Library Section */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-text-primary">Your Library</h3>
        
        {libraryError ? (
          <div className="text-center py-8">
            <p className="text-text-secondary text-sm">Unable to load library</p>
            <p className="text-xs text-text-secondary mt-1">{libraryError}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm">Your library is empty</p>
            <p className="text-xs text-text-secondary mt-1">Generate compositions to build your collection</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => (
              <motion.li
                key={`${item.t}:${(item as any).id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-border bg-bgElev flex items-center justify-between hover:border-emerald/50 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-emerald group-hover:text-emeraldMuted transition-colors">
                    {getItemIcon(item)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text-primary group-hover:text-emerald transition-colors truncate">
                      {getItemTitle(item)}
                    </div>
                    <div className="text-sm text-text-secondary truncate">
                      {getItemSubtitle(item)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleFavorite(item)}
                    className={`p-2 rounded-lg transition-colors ${
                      isFavorited((item as any).id, item.t)
                        ? 'text-warning bg-warning/20 hover:bg-warning/30'
                        : 'text-text-secondary hover:bg-border hover:text-text-primary'
                    }`}
                    aria-label={isFavorited((item as any).id, item.t) ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  <button
                    className="p-2 rounded-lg text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                    aria-label="More options"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      {/* Playlists Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">Playlists</h3>
          <button
            className="px-3 py-2 rounded-xl bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors"
            onClick={() => setIsCreatingPlaylist(!isCreatingPlaylist)}
          >
            New
          </button>
        </div>

        {/* Create Playlist Form */}
        {isCreatingPlaylist && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl border border-border bg-bgElev"
          >
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Playlist name"
                value={newPlaylistTitle}
                onChange={(e) => setNewPlaylistTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-violet"
                onKeyPress={(e) => e.key === 'Enter' && handleCreatePlaylist()}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistTitle.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setIsCreatingPlaylist(false);
                    setNewPlaylistTitle('');
                  }}
                  className="px-4 py-2 rounded-lg bg-bgElev text-text-secondary hover:bg-border transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {playlistsError ? (
          <div className="text-center py-8">
            <p className="text-text-secondary text-sm">Unable to load playlists</p>
            <p className="text-xs text-text-secondary mt-1">{playlistsError}</p>
          </div>
        ) : lists.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
            <p className="text-text-secondary text-sm">No playlists yet</p>
            <p className="text-xs text-text-secondary mt-1">Create a playlist to organize your favorites</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {lists.map((playlist, index) => (
              <motion.li
                key={playlist.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-border bg-bgElev hover:border-emerald/50 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-text-primary group-hover:text-emerald transition-colors">
                      {playlist.title}
                    </div>
                    <div className="text-sm text-text-secondary mt-1">
                      {playlist.items.length} item{playlist.items.length !== 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-text-secondary mt-1">
                      Updated {new Date(playlist.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded-lg text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                      aria-label="Play playlist"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6-8h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2v-8a2 2 0 012-2z" />
                      </svg>
                    </button>
                    <button
                      className="p-2 rounded-lg text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                      aria-label="Edit playlist"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
