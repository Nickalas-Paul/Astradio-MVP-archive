'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCircles } from '../../core/social/hooks';
import { isFeatureEnabled } from '../../core/config/flags';
import { trackFeatureUse } from '../../core/telemetry';

export default function CirclesPanel() {
  const { circles, create, loading, error } = useCircles();
  const [isCreating, setIsCreating] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');

  // Don't render if feature is disabled
  if (!isFeatureEnabled('ENABLE_SOCIAL')) {
    return null;
  }

  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) return;
    
    trackFeatureUse('social', 'create_circle');
    setIsCreating(true);
    
    try {
      await create(newCircleName.trim());
      setNewCircleName('');
    } catch (error) {
      console.error('Failed to create circle:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">Circles</h3>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-text-primary">Circles</h3>
        <div className="text-center py-8">
          <p className="text-text-secondary text-sm">Unable to load circles</p>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Circles</h3>
        <button 
          className="px-3 py-2 rounded-xl bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors"
          onClick={() => setIsCreating(!isCreating)}
        >
          New
        </button>
      </div>

      {/* Create Circle Form */}
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
              placeholder="Circle name"
              value={newCircleName}
              onChange={(e) => setNewCircleName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border text-text-primary focus:outline-none focus:ring-2 focus:ring-violet"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateCircle()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateCircle}
                disabled={!newCircleName.trim() || isCreating}
                className="px-4 py-2 rounded-lg bg-emerald text-bg font-medium hover:bg-emeraldMuted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewCircleName('');
                }}
                className="px-4 py-2 rounded-lg bg-bgElev text-text-secondary hover:bg-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Circles List */}
      {circles.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-bgElev border border-border rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-text-secondary text-sm">No circles yet</p>
          <p className="text-xs text-text-secondary mt-1">Create a circle to start collaborating</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {circles.map((circle, index) => (
            <motion.li
              key={circle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-2xl border border-border bg-bgElev hover:border-emerald/50 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium text-text-primary group-hover:text-emerald transition-colors">
                    {circle.name}
                  </div>
                  <div className="text-text-secondary text-sm mt-1">
                    {circle.memberIds.length} member{circle.memberIds.length !== 1 ? 's' : ''}
                  </div>
                  {circle.inviteCode && (
                    <div className="text-xs text-violet mt-1">
                      Invite: {circle.inviteCode}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 rounded-lg text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                    aria-label="View circle details"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  <button
                    className="p-2 rounded-lg text-text-secondary hover:bg-border hover:text-text-primary transition-colors"
                    aria-label="Share circle"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                  </button>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
