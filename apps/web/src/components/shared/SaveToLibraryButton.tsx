'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/core/api-base';

export interface SaveToLibraryProps {
  exportId: string;
  source: string;
  compositionType: string;
  sandboxState: Record<string, unknown>;
  label?: string;
  /** Dedup key; matches object_identity_hash when set on save. */
  objectIdentityHash?: string;
  onSaved?: () => void;
}

type UiState = 'checking' | 'idle' | 'saving';

function rowMatches(
  row: Record<string, unknown>,
  source: string,
  exportId: string,
  objectIdentityHash?: string,
  sandboxState?: Record<string, unknown>
): boolean {
  if (String(row.source || '') !== source) return false;
  const rowExport = typeof row.export_id === 'string' ? row.export_id.trim() : '';
  if (rowExport && rowExport === exportId) return true;
  const rowHash =
    typeof row.object_identity_hash === 'string' ? row.object_identity_hash.trim() : '';
  if (objectIdentityHash && rowHash && rowHash === objectIdentityHash) return true;
  if (sandboxState?.postId) {
    const ps = row.sandbox_state;
    if (ps && typeof ps === 'object' && !Array.isArray(ps)) {
      const postId = (ps as { postId?: unknown }).postId;
      if (typeof postId === 'string' && postId === String(sandboxState.postId)) return true;
    }
  }
  if (sandboxState?.relationshipId) {
    const ps = row.sandbox_state;
    if (ps && typeof ps === 'object' && !Array.isArray(ps)) {
      const relId = (ps as { relationshipId?: unknown }).relationshipId;
      if (typeof relId === 'string' && relId === String(sandboxState.relationshipId)) return true;
    }
  }
  if (sandboxState?.groupId) {
    const ps = row.sandbox_state;
    if (ps && typeof ps === 'object' && !Array.isArray(ps)) {
      const gid = (ps as { groupId?: unknown }).groupId;
      if (typeof gid === 'string' && gid === String(sandboxState.groupId)) return true;
    }
  }
  if (sandboxState?.chartId && source === 'profile_identity') {
    const ps = row.sandbox_state;
    if (ps && typeof ps === 'object' && !Array.isArray(ps)) {
      const cid = (ps as { chartId?: unknown }).chartId;
      if (typeof cid === 'string' && cid === String(sandboxState.chartId)) return true;
    }
  }
  return false;
}

export function SaveToLibraryButton({
  exportId,
  source,
  compositionType,
  sandboxState,
  label,
  objectIdentityHash,
  onSaved,
}: SaveToLibraryProps) {
  const [uiState, setUiState] = useState<UiState>('checking');
  const [inLibrary, setInLibrary] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showError, setShowError] = useState(false);

  const checkSaved = useCallback(async () => {
    const eid = String(exportId || '').trim();
    if (!/^[a-f0-9]{64}$/.test(eid)) {
      setUiState('idle');
      setInLibrary(false);
      return;
    }
    setUiState('checking');
    try {
      const base = getApiBaseUrl();
      const r = await fetch(`${base || ''}/api/sandbox/compositions?limit=50`, {
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => []);
      const list = Array.isArray(j) ? j : [];
      const found = list.some((row) =>
        rowMatches(row as Record<string, unknown>, source, eid, objectIdentityHash, sandboxState)
      );
      setInLibrary(found);
      setUiState('idle');
    } catch {
      setInLibrary(false);
      setUiState('idle');
    }
  }, [exportId, source, objectIdentityHash, sandboxState]);

  useEffect(() => {
    void checkSaved();
  }, [checkSaved]);

  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), 2000);
    return () => window.clearTimeout(t);
  }, [justSaved]);

  useEffect(() => {
    if (!showError) return;
    const t = window.setTimeout(() => setShowError(false), 3000);
    return () => window.clearTimeout(t);
  }, [showError]);

  const handleSave = async () => {
    const eid = String(exportId || '').trim();
    if (!/^[a-f0-9]{64}$/.test(eid)) return;
    const hash = objectIdentityHash?.trim() || eid;
    setUiState('saving');
    setShowError(false);
    try {
      const base = getApiBaseUrl();
      const r = await fetch(`${base || ''}/api/sandbox/compositions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          sandbox_state: sandboxState,
          vector_hash: hash,
          seed: `save_${source}_${hash.slice(0, 16)}`,
          plan_hash: hash,
          report: {
            savedFrom: source,
            label: label || null,
            at: new Date().toISOString(),
          },
          export_id: eid,
          source,
          composition_type: compositionType,
          object_identity_hash: objectIdentityHash?.trim() || null,
        }),
      });
      if (!r.ok) {
        throw new Error('save_failed');
      }
      setInLibrary(true);
      setJustSaved(true);
      onSaved?.();
    } catch {
      setShowError(true);
    } finally {
      setUiState('idle');
    }
  };

  const eid = String(exportId || '').trim();
  if (!/^[a-f0-9]{64}$/.test(eid)) return null;

  if (uiState === 'checking') {
    return <p className="text-xs text-text-muted">Checking library…</p>;
  }

  if (inLibrary || justSaved) {
    return <p className="text-xs text-text-muted">Saved</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent disabled:opacity-50"
        disabled={uiState === 'saving'}
        onClick={() => void handleSave()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-3.5 h-3.5 shrink-0"
          aria-hidden
        >
          <path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v13A1.5 1.5 0 0 0 3.5 18h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-13ZM5 4h10v11H5V4Z" />
        </svg>
        {uiState === 'saving' ? 'Saving…' : 'Save to Library'}
      </button>
      {showError ? <p className="text-xs text-red-400">Could not save</p> : null}
    </div>
  );
}
