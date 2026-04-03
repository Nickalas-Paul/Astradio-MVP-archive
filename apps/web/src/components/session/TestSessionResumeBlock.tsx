'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '../../core/social/hooks';

/**
 * Shown only when server has ENABLE_TEST_SESSION_RESUME=1.
 * Lets QA re-attach the session cookie to an existing user id (no password).
 */
export function TestSessionResumeBlock() {
  const [enabled, setEnabled] = useState(false);
  const [userId, setUserId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { refresh } = useProfile();

  useEffect(() => {
    fetch('/api/session/test-resume', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((d) => setEnabled(d?.enabled === true))
      .catch(() => setEnabled(false));
    try {
      const last = typeof localStorage !== 'undefined' ? localStorage.getItem('astradio_last_user_id') : null;
      if (last) setUserId((u) => (u.trim() ? u : last));
    } catch {
      /* ignore */
    }
  }, []);

  if (!enabled) return null;

  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Test session resume</h2>
      <p className="text-xs text-subtext">
        Paste a known user id to restore the signed session cookie (QA only). Requires ENABLE_TEST_SESSION_RESUME on the server.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="User id (UUID)"
          className="input flex-1 min-w-[200px] font-mono text-sm"
        />
        <button
          type="button"
          disabled={busy || !userId.trim()}
          className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              const r = await fetch('/api/session/resume', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userId.trim() }),
              });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) {
                setMsg(typeof j.error === 'string' ? j.error : `Failed (${r.status})`);
                return;
              }
              setMsg('Session restored. Reloading profile…');
              await refresh();
              setMsg('Session restored. Profile refreshed.');
            } catch (e) {
              setMsg(e instanceof Error ? e.message : 'Request failed');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Working…' : 'Resume session'}
        </button>
      </div>
      {msg ? <p className="text-xs text-subtext">{msg}</p> : null}
    </section>
  );
}
