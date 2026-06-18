'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OverflowMenuIcon } from '@/components/community/posts/community-post-icons';
import { Button } from '@/components/shared/Button';

type Props = {
  relationshipId: string;
  peerDisplayName: string;
  peerUserId: string;
  onActionComplete?: () => void;
  className?: string;
};

export function ConnectionOverflowMenu({
  relationshipId,
  peerDisplayName,
  peerUserId,
  onActionComplete,
  className = '',
}: Props) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'remove' | 'block' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const name = peerDisplayName.trim() || 'this user';

  const runRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/community/relationships/${encodeURIComponent(relationshipId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Could not remove connection');
        return;
      }
      setConfirmKind(null);
      onActionComplete?.();
      router.push('/community');
    } catch {
      setError('Could not remove connection');
    } finally {
      setBusy(false);
    }
  };

  const runBlock = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/community/block', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedUserId: peerUserId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Could not block user');
        return;
      }
      setConfirmKind(null);
      onActionComplete?.();
      router.push('/community');
    } catch {
      setError('Could not block user');
    } finally {
      setBusy(false);
    }
  };

  if (confirmKind) {
    const isRemove = confirmKind === 'remove';
    return (
      <div className={`rounded-lg border border-border bg-surface-1 p-4 space-y-3 ${className}`.trim()}>
        <p className="text-sm text-text-primary">
          {isRemove
            ? 'Remove this connection? Your reading history will be preserved, but daily transit weather for this connection will stop.'
            : `Block ${name}? They won't be able to message you or request a connection. This also removes the connection.`}
        </p>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setConfirmKind(null);
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="!bg-red-600 hover:!bg-red-700 !border-red-600"
            disabled={busy}
            loading={busy}
            onClick={() => void (isRemove ? runRemove() : runBlock())}
          >
            {isRemove ? 'Remove connection' : 'Block user'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 ${className}`.trim()} ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-text-muted hover:text-text-primary transition-colors"
        aria-label="Connection options"
        aria-expanded={menuOpen}
      >
        <OverflowMenuIcon />
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-full mt-1 z-20 min-w-[180px] rounded-lg border border-border bg-surface-1 shadow-lg py-1">
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-surface-2"
            onClick={() => {
              setMenuOpen(false);
              setConfirmKind('remove');
            }}
          >
            Remove connection
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-surface-2"
            onClick={() => {
              setMenuOpen(false);
              setConfirmKind('block');
            }}
          >
            Block user
          </button>
        </div>
      ) : null}
    </div>
  );
}
