'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/core/api-base';
import { isFeatureEnabled } from '@/core/config/flags';

export interface CommunityNotification {
  id: string;
  recipientUserId: string;
  type: 'reply' | 'mention' | 'like';
  postId?: string;
  commentId?: string;
  actorUserId?: string;
  preview?: string;
  createdAt: string;
}

export function useCommunityNotifications(enabled = true) {
  const [notifications, setNotifications] = useState<CommunityNotification[]>([]);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`${getApiBaseUrl() || ''}/api/community/notifications`, {
      credentials: 'same-origin',
    });
    if (!r.ok) return;
    const data = await r.json();
    if (Array.isArray(data.notifications)) setNotifications(data.notifications);
  }, []);

  useEffect(() => {
    if (!enabled || !isFeatureEnabled('ENABLE_COMMUNITY_POSTS')) return;
    void refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !isFeatureEnabled('ENABLE_COMMUNITY_POSTS')) return;
    if (typeof EventSource === 'undefined') return;

    const es = new EventSource(`${getApiBaseUrl() || ''}/api/community/events/stream`);

    es.addEventListener('connected', () => setConnected(true));
    es.addEventListener('notification', (ev) => {
      try {
        const record = JSON.parse((ev as MessageEvent).data) as CommunityNotification;
        setNotifications((prev) => [record, ...prev.filter((n) => n.id !== record.id)].slice(0, 50));
      } catch {
        // ignore malformed events
      }
    });
    es.addEventListener('feed', () => {
      void refresh();
    });
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, [enabled, refresh]);

  return { notifications, connected, refresh };
}
