'use client';

import Link from 'next/link';
import { Card } from '@/components/shared/Card';
import { useCommunityNotifications } from '@/core/social/community-notifications-hooks';
import { isFeatureEnabled } from '@/config/flags';

export function CommunityNotificationsPanel() {
  if (!isFeatureEnabled('ENABLE_COMMUNITY_POSTS')) return null;

  const { notifications, connected } = useCommunityNotifications();

  if (notifications.length === 0) {
    return connected ? (
      <p className="text-xs text-text-secondary">Live updates connected.</p>
    ) : null;
  }

  return (
    <Card elevation="flat" size="sm" className="space-y-2" aria-live="polite">
      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
        Notifications {connected ? '· live' : ''}
      </h3>
      <ul className="space-y-2 max-h-48 overflow-y-auto">
        {notifications.slice(0, 8).map((n) => (
          <li key={n.id} className="text-xs text-text-primary">
            {n.type === 'like' ? 'Someone liked your post' : null}
            {n.type === 'reply' ? 'New reply on your post' : null}
            {n.type === 'mention' ? 'You were mentioned' : null}
            {n.preview ? `: ${n.preview}` : null}
            {n.postId ? (
              <>
                {' '}
                <Link href={`/community/post/${n.postId}`} className="text-accent hover:underline">
                  View
                </Link>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
