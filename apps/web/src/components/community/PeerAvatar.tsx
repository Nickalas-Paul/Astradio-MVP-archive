'use client';

import { useState } from 'react';
import { getApiBaseUrl } from '../../core/api-base';

type PeerAvatarProps = {
  peerUserId: string | null | undefined;
  displayName: string;
  /** Circle diameter in px — default 40 (connection cards). */
  size?: number;
};

export function PeerAvatar({ peerUserId, displayName, size = 40 }: PeerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (displayName || 'Connection').charAt(0).toUpperCase();
  const userId = typeof peerUserId === 'string' ? peerUserId.trim() : '';
  const avatarSrc =
    userId && !imgFailed ? `${getApiBaseUrl() || ''}/api/profile/avatar/${encodeURIComponent(userId)}` : null;
  const fontSize = Math.max(10, Math.round(size * 0.38));

  if (avatarSrc) {
    return (
      <img
        src={avatarSrc}
        alt=""
        className="rounded-full object-cover bg-surface-2 shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
