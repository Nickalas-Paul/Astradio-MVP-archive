'use client';

import { useEffect, useState } from 'react';
import type { ProfileUser } from '../../core/social/hooks';

export interface ProfilePanelFooterProps {
  user: ProfileUser;
  onPrivacyUpdate: () => void | Promise<void>;
}

function PrivacyToggleRow({
  id,
  checked,
  disabled,
  onChange,
  label,
  sublabel,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  sublabel: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-border shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-sm text-text-primary">{label}</span>
        <span className="block text-xs text-text-secondary mt-0.5">{sublabel}</span>
      </span>
    </label>
  );
}

export function ProfilePanelFooter({ user, onPrivacyUpdate }: ProfilePanelFooterProps) {
  const [profileSaving, setProfileSaving] = useState(false);
  const [communityPublic, setCommunityPublic] = useState(true);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [communitySaving, setCommunitySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadCommunitySettings() {
      setCommunityLoading(true);
      try {
        const r = await fetch('/api/community/settings', { credentials: 'same-origin' });
        if (r.ok) {
          const data = (await r.json()) as { publicVisibility?: boolean };
          if (!cancelled) setCommunityPublic(data.publicVisibility !== false);
        } else if (!cancelled) {
          setCommunityPublic(true);
        }
      } catch {
        if (!cancelled) setCommunityPublic(true);
      } finally {
        if (!cancelled) setCommunityLoading(false);
      }
    }
    void loadCommunitySettings();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const showDiscovery = user?.discoverable !== undefined;
  const showToday = user?.show_in_feed !== undefined;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">Privacy</h3>
      <div className="space-y-4">
        {showDiscovery ? (
          <PrivacyToggleRow
            id="privacy-discoverable"
            checked={user.discoverable !== false}
            disabled={profileSaving}
            label="Visible in Discovery"
            sublabel="Other users can find you through compatibility matching"
            onChange={async (val) => {
              setProfileSaving(true);
              try {
                const r = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ discoverable: val }),
                  credentials: 'same-origin',
                });
                if (r.ok) await onPrivacyUpdate();
              } finally {
                setProfileSaving(false);
              }
            }}
          />
        ) : null}
        {showToday ? (
          <PrivacyToggleRow
            id="privacy-show-in-feed"
            checked={user.show_in_feed !== false}
            disabled={profileSaving}
            label="Show in Today feed"
            sublabel="Your transit activity appears in connected users' Today page"
            onChange={async (val) => {
              setProfileSaving(true);
              try {
                const r = await fetch('/api/profile', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ show_in_feed: val }),
                  credentials: 'same-origin',
                });
                if (r.ok) await onPrivacyUpdate();
              } finally {
                setProfileSaving(false);
              }
            }}
          />
        ) : null}
        <PrivacyToggleRow
          id="privacy-community-feed"
          checked={communityPublic}
          disabled={communityLoading || communitySaving}
          label="Show posts in Community feed"
          sublabel="When off, your posts and community profile are hidden from other users"
          onChange={async (val) => {
            setCommunitySaving(true);
            try {
              const r = await fetch('/api/community/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ publicVisibility: val }),
              });
              if (r.ok) {
                const data = (await r.json()) as { publicVisibility?: boolean };
                setCommunityPublic(data.publicVisibility !== false);
              }
            } finally {
              setCommunitySaving(false);
            }
          }}
        />
      </div>
    </div>
  );
}
