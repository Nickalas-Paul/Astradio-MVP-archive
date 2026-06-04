'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSessions, useCircles } from '../../core/social/hooks';
import { isFeatureEnabled } from '../../core/config/flags';
import { trackFeatureUse } from '../../core/telemetry';

export default function SessionsPanel() {
  const { sessions, create, join, leave, next, previous, loading, error } = useSessions();
  const { circles } = useCircles();
  const [isCreating, setIsCreating] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [selectedCircleId, setSelectedCircleId] = useState<string>('');

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_SOCIAL')) {
    return null;
  }

  const handleCreateSession = async () => {
    if (!newSessionTitle.trim()) return;
    
    trackFeatureUse('social', 'create_session');
    
    try {
      await create(newSessionTitle.trim(), selectedCircleId || undefined);
      setNewSessionTitle('');
      setSelectedCircleId('');
      setIsCreating(false);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleJoinSession = async (sessionId: string) => {
    trackFeatureUse('social', 'join_session');
    await join(sessionId);
  };

  const handleLeaveSession = async (sessionId: string) => {
    trackFeatureUse('social', 'leave_session');
    await leave(sessionId);
  };

  const handleNextTrack = async (sessionId: string) => {
    trackFeatureUse('social', 'next_track');
    await next(sessionId);
  };

  const handlePreviousTrack = async (sessionId: string) => {
    trackFeatureUse('social', 'previous_track');
    await previous(sessionId);
  };

  const getCurrentTrack = (session: any) => {
    const currentItem = session.queue[session.currentIndex];
    if (!currentItem) return 'No tracks';
    
    if (currentItem.t === 'composition') {
      return currentItem.title;
    } else if (currentItem.t === 'pair') {
      return `Pair: ${currentItem.label}`;
    } else {
      return `Chart: ${currentItem.label}`;
    }
  };

  const getCurrentGenre = (session: any) => {
    const currentItem = session.queue[session.currentIndex];
    return currentItem?.t === 'composition' ? currentItem.genre : null;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">Sessions</h3>
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">Sessions</h3>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">Unable to load sessions</p>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Sessions</h3>
        <button 
          className="px-3 py-2 rounded-xl bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors"
          onClick={() => setIsCreating(!isCreating)}
        >
          Start Session
        </button>
      </div>

      {/* Create Session Form */}
      {isCreating && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="p-4 rounded-2xl border border-border bg-bgElev"
        >
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Session title"
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-violet"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
            />
            <select
              value={selectedCircleId}
              onChange={(e) => setSelectedCircleId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-violet"
            >
              <option value="">No circle (public session)</option>
              {circles.map(circle => (
                <option key={circle.id} value={circle.id}>
                  {circle.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleCreateSession}
                disabled={!newSessionTitle.trim()}
                className="px-4 py-2 rounded-lg bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewSessionTitle('');
                  setSelectedCircleId('');
                }}
                className="px-4 py-2 rounded-lg bg-bgElev text-text-secondary hover:bg-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-text-secondary text-sm">No active sessions</p>
          <p className="text-xs text-text-secondary mt-1">Start a session to begin listening together</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((session, index) => (
            <motion.li
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-2xl border border-border bg-bgElev hover:border-emerald/50 transition-colors group"
            >
              <div className="space-y-3">
                {/* Session Header */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-text-primary group-hover:text-emerald transition-colors">
                      {session.title}
                    </div>
                    <div className="text-text-secondary text-sm mt-1">
                      {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.participants.includes('u_me') ? (
                      <button
                        onClick={() => handleLeaveSession(session.id)}
                        className="px-3 py-1 rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors text-sm"
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinSession(session.id)}
                        className="px-3 py-1 rounded-lg bg-emerald text-bg hover:bg-emeraldMuted transition-colors text-sm"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>

                {/* Now Playing */}
                <div className="space-y-2">
                  <div className="text-sm text-text-secondary">Now Playing:</div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-text-primary">
                        {getCurrentTrack(session)}
                      </div>
                      {getCurrentGenre(session) && (
                        <div className="text-xs text-violet">
                          {getCurrentGenre(session)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePreviousTrack(session.id)}
                        className="p-2 rounded-lg text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                        aria-label="Previous track"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.333 4z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleNextTrack(session.id)}
                        className="p-2 rounded-lg text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                        aria-label="Next track"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Queue Info */}
                <div className="text-xs text-text-secondary">
                  Track {session.currentIndex + 1} of {session.queue.length}
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
