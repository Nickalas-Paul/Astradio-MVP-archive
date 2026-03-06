'use client';

import { useState, useEffect } from 'react';
import { getPlayableLyriaUrl } from '../core/audio/lyria-playback';

interface LyriaAudioProps {
  url?: string | null;
  base64?: string | null;
  controls?: boolean;
  className?: string;
}

/**
 * Lyria-only audio element. Validates url/base64 via getPlayableLyriaUrl; renders <audio> or fail-closed message.
 */
export function LyriaAudio({ url, base64, controls = true, className = '' }: LyriaAudioProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url && !base64) {
      setSrc(null);
      setError(null);
      return;
    }
    try {
      setSrc(getPlayableLyriaUrl({ url: url ?? undefined, base64: base64 ?? undefined }));
      setError(null);
    } catch {
      setSrc(null);
      setError('Audio unavailable (Lyria-only).');
    }
  }, [url, base64]);

  if (error) {
    return <p className="text-sm text-amber-400">{error}</p>;
  }
  if (!src) return null;
  return <audio controls={controls} src={src} className={className} />;
}
