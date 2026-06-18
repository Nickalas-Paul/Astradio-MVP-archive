'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

export type BlockedUserRow = {
  id: string;
  blockedUserId: string;
  displayName?: string | null;
  handle?: string | null;
  createdAt?: string;
};

export function BlockedUsersSection() {
  const [users, setUsers] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/community/blocks', { credentials: 'same-origin' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof j.error === 'string' ? j.error : 'Could not load blocked users');
        setUsers([]);
        return;
      }
      setUsers(Array.isArray(j.users) ? (j.users as BlockedUserRow[]) : []);
    } catch {
      setError('Could not load blocked users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unblock = async (blockedUserId: string) => {
    setUnblocking(blockedUserId);
    try {
      const r = await fetch(`/api/community/block/${encodeURIComponent(blockedUserId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(typeof j.error === 'string' ? j.error : 'Unblock failed');
        return;
      }
      await load();
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-h4 font-semibold text-text-primary">Blocked users</h2>
        <p className="text-sm text-text-secondary mt-1">
          Blocked users cannot message you or send connection requests. Unblocking does not restore a connection.
        </p>
      </div>
      {loading ? <p className="text-sm text-text-secondary">Loading…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {!loading && users.length === 0 ? (
        <p className="text-sm text-text-secondary">You have not blocked anyone.</p>
      ) : null}
      {users.length > 0 ? (
        <ul className="space-y-2">
          {users.map((u) => {
            const label =
              (u.displayName && u.displayName.trim()) ||
              (u.handle && `@${u.handle}`) ||
              u.blockedUserId;
            return (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-border bg-surface-1"
              >
                <span className="text-sm text-text-primary">{label}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={unblocking === u.blockedUserId}
                  loading={unblocking === u.blockedUserId}
                  onClick={() => void unblock(u.blockedUserId)}
                >
                  Unblock
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
