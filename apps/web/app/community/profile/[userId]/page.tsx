'use client';

import { use } from 'react';
import { AppShell } from '@/components/AppShell';
import { CommunityProfileCard } from '@/components/community/posts/CommunityProfileCard';
import { useCommunityPublicProfile } from '@/core/social/community-posts-hooks';

export default function CommunityProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { profile, loading, error } = useCommunityPublicProfile(userId);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6">
        {loading ? <p className="text-sm text-text-secondary">Loading profile…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {profile ? <CommunityProfileCard profile={profile} /> : null}
      </div>
    </AppShell>
  );
}
