'use client';

import { useEffect, useState } from 'react';
import { ValidatedExportAudioPlayer } from '@/components/community/ValidatedExportAudioPlayer';
import { SaveToLibraryButton } from '@/components/shared/SaveToLibraryButton';
import { exportAudioHeadAvailable } from '@/lib/community/export-audio-blob';
import { clearCommunityPostAudio } from '@/core/social/community-posts-hooks';

interface CommunityPostAudioSectionProps {
  postId: string;
  exportId: string;
  audioLabel?: string | null;
  currentUserId?: string | null;
  postUserId: string;
  onAudioCleared?: () => void;
}

export function CommunityPostAudioSection({
  postId,
  exportId,
  audioLabel,
  currentUserId,
  postUserId,
  onAudioCleared,
}: CommunityPostAudioSectionProps) {
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [clearing, setClearing] = useState(false);
  const isOwner = Boolean(currentUserId && currentUserId === postUserId);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    void exportAudioHeadAvailable(exportId).then((ok) => {
      if (!cancelled) {
        setAvailable(ok);
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [exportId]);

  const removeAudio = async () => {
    setClearing(true);
    try {
      await clearCommunityPostAudio(postId);
      onAudioCleared?.();
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface-0/50 p-3">
      {audioLabel ? (
        <p className="text-xs text-text-secondary mb-2 truncate">{audioLabel}</p>
      ) : null}
      {checking ? (
        <p className="text-xs text-text-muted">Checking audio…</p>
      ) : available ? (
        <div className="space-y-2">
          <ValidatedExportAudioPlayer exportId={exportId} />
          <SaveToLibraryButton
            exportId={exportId}
            source="community_post_audio"
            compositionType="A"
            objectIdentityHash={`post_${postId}_${exportId.slice(0, 16)}`}
            sandboxState={{
              kind: 'community_post_audio',
              postId,
              originalLabel: audioLabel || null,
            }}
            label={audioLabel || 'Community audio'}
          />
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-xs text-text-muted">This audio is no longer available</p>
          {isOwner ? (
            <p className="text-xs text-text-muted">
              You can{' '}
              <button
                type="button"
                className="text-accent hover:underline disabled:opacity-50"
                disabled={clearing}
                onClick={() => void removeAudio()}
              >
                {clearing ? 'removing it' : 'remove it'}
              </button>
              .
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
