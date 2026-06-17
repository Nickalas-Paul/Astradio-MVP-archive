'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { getApiBaseUrl } from '@/core/api-base';
import { exportAudioHeadAvailable } from '@/lib/community/export-audio-blob';
import { libraryRowSummary } from '@/components/profile/shared/profile-library-utils';

export interface AudioArtifactOption {
  exportId: string;
  label: string;
}

type PickerRow = {
  row: Record<string, unknown>;
  exportId: string;
  label: string;
  available: boolean;
};

interface CommunityAudioArtifactPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (artifact: AudioArtifactOption) => void;
}

export function CommunityAudioArtifactPicker({ open, onClose, onSelect }: CommunityAudioArtifactPickerProps) {
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${getApiBaseUrl() || ''}/api/sandbox/compositions?limit=50`, {
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => []);
      const list = Array.isArray(j) ? j : [];
      const withExport = list.filter((row) => {
        const exportId = typeof row.export_id === 'string' ? row.export_id.trim() : '';
        return exportId.length > 0;
      });
      const checked = await Promise.all(
        withExport.map(async (row) => {
          const exportId = String(row.export_id).trim();
          const available = await exportAudioHeadAvailable(exportId);
          return {
            row,
            exportId,
            label: libraryRowSummary(row) || 'Saved reading',
            available,
          };
        })
      );
      setRows(checked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load library');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [load, open]);

  if (!open) return null;

  const selectable = rows.filter((r) => r.available);
  const unavailable = rows.filter((r) => !r.available);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="presentation"
      onClick={onClose}
    >
      <Card
        elevation="floating"
        size="md"
        className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 id="audio-picker-title" className="text-h3 font-serif text-text-primary">
            Attach audio from Library
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-text-secondary hover:text-text-primary min-h-[44px] px-2"
          >
            Close
          </button>
        </div>
        {loading ? <p className="text-sm text-text-secondary">Loading saved audio…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {!loading && selectable.length === 0 && unavailable.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No saved audio artifacts yet. Create and save a reading in My Sky or Sandbox first.
          </p>
        ) : null}
        {!loading && selectable.length === 0 && unavailable.length > 0 ? (
          <p className="text-sm text-text-secondary mb-3">
            Saved readings found, but none have playable audio files right now.
          </p>
        ) : null}
        <ul className="space-y-2 overflow-y-auto flex-1 min-h-0">
          {selectable.map((item) => (
            <li key={String(item.row.id || item.exportId)}>
              <button
                type="button"
                className="w-full text-left rounded-lg border border-border bg-surface-1 px-3 py-3 hover:bg-surface-2 hover:border-accent/40 transition-colors"
                onClick={() => {
                  onSelect({ exportId: item.exportId, label: item.label });
                  onClose();
                }}
              >
                <span className="text-sm text-text-primary block truncate">{item.label}</span>
              </button>
            </li>
          ))}
          {unavailable.map((item) => (
            <li key={`unavail-${String(item.row.id || item.exportId)}`}>
              <div
                className="w-full rounded-lg border border-border/60 bg-surface-0/50 px-3 py-3 opacity-60 cursor-not-allowed"
                aria-disabled="true"
              >
                <span className="text-sm text-text-muted block truncate">{item.label}</span>
                <span className="text-xs text-text-muted block mt-1">Audio file unavailable</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="pt-4 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
