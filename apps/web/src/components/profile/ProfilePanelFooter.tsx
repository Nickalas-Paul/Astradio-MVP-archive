'use client';

import { useState } from 'react';
import type { ProfileUser } from '../../core/social/hooks';

export interface ProfilePanelFooterProps {
  user: ProfileUser;
  onPrivacyUpdate: () => void | Promise<void>;
}

export function ProfilePanelFooter({ user, onPrivacyUpdate }: ProfilePanelFooterProps) {
  const [privacySaving, setPrivacySaving] = useState(false);

  if (user?.discoverable === undefined && user?.show_in_feed === undefined) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Community visibility</h3>
      <p className="text-xs text-text-secondary">Control how others can find you. Off = hidden from search or transits.</p>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={user?.discoverable !== false}
            disabled={privacySaving}
            onChange={async (e) => {
              const val = e.target.checked;
              setPrivacySaving(true);
              try {
                const r = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ discoverable: val }),
                  credentials: 'same-origin',
                });
                if (r.ok) await onPrivacyUpdate();
              } finally {
                setPrivacySaving(false);
              }
            }}
            className="rounded border-border"
          />
          <span className="text-sm text-text-primary">Show in community search</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={user?.show_in_feed !== false}
            disabled={privacySaving}
            onChange={async (e) => {
              const val = e.target.checked;
              setPrivacySaving(true);
              try {
                const r = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ show_in_feed: val }),
                  credentials: 'same-origin',
                });
                if (r.ok) await onPrivacyUpdate();
              } finally {
                setPrivacySaving(false);
              }
            }}
            className="rounded border-border"
          />
          <span className="text-sm text-text-primary">Show in community transits</span>
        </label>
      </div>
    </div>
  );
}
