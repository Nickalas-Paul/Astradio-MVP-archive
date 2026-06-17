'use client';

import Link from 'next/link';
import { Card } from '@/components/shared/Card';
import { CommunityPostCard } from '@/components/community/posts/CommunityPostCard';
import type { CommunityPublicProfile } from '@/core/social/community-posts-hooks';

interface CommunityProfileCardProps {
  profile: CommunityPublicProfile;
}

export function CommunityProfileCard({ profile }: CommunityProfileCardProps) {
  const name = profile.displayName || profile.handle || profile.userId;
  return (
    <Card elevation="resting" className="space-y-4">
      <div className="flex items-start gap-4">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-surface-2 border border-border flex items-center justify-center text-lg text-text-secondary">
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="space-y-1 min-w-0">
          <h1 className="text-h2 font-serif text-text-primary truncate">{name}</h1>
          {profile.handle ? <p className="text-sm text-text-secondary">@{profile.handle}</p> : null}
          {profile.bio ? <p className="text-body-sm text-text-primary whitespace-pre-wrap">{profile.bio}</p> : null}
          <p className="text-xs text-text-secondary">{profile.postCount} posts</p>
        </div>
      </div>
      {profile.recentPosts?.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Recent posts</h2>
          <ul className="space-y-3">
            {profile.recentPosts.map((post) => (
              <li key={post.id}>
                <CommunityPostCard post={post} compact />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-text-secondary">No posts yet.</p>
      )}
      <Link href="/community?tab=feed" className="text-sm text-accent hover:underline inline-block">
        ← Back to feed
      </Link>
    </Card>
  );
}
