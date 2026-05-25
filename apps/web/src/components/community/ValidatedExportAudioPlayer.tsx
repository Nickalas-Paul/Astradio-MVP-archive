'use client';

import { useEffect, useState, useRef } from 'react';
import { createExportAudioObjectUrl } from '../../lib/community/export-audio-blob';

type Status = 'idle' | 'checking' | 'playable' | 'unavailable';

/**
 * Validates export by fetching /api/exports/:id once. No automatic retries.
 */
export function ValidatedExportAudioPlayer({ exportId }: { exportId: string | null | undefined }) {
  const [status, setStatus] = useState<Status>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const id = String(exportId || '').trim();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (!id) {
      setStatus('idle');
      setUrl(null);
      return;
    }
    let cancelled = false;
    setStatus('checking');
    setUrl(null);
    (async () => {
      const result = await createExportAudioObjectUrl(id);
      if (cancelled) {
        if ('objectUrl' in result) URL.revokeObjectURL(result.objectUrl);
        return;
      }
      if ('error' in result) {
        setStatus('unavailable');
        return;
      }
      objectUrlRef.current = result.objectUrl;
      setUrl(result.objectUrl);
      setStatus('playable');
    })();
    return () => {
      cancelled = true;
    };
  }, [exportId]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  if (!exportId || !String(exportId).trim()) return null;
  if (status === 'checking' || status === 'idle') {
    return <p className="text-sm text-subtext">Checking sound…</p>;
  }
  if (status === 'unavailable') {
    return <p className="text-sm text-amber-600 dark:text-amber-300">Sound unavailable</p>;
  }
  if (!url) return null;
  return (
    <div className="pt-1 space-y-2">
      <p className="text-sm text-text-secondary">Listen to this reading</p>
      <audio controls className="w-full max-w-md" src={url} preload="metadata" />
    </div>
  );
}
