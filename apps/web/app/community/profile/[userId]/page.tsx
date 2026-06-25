'use client';

import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CommunityProfileCard } from '@/components/community/posts/CommunityProfileCard';
import { useCommunityPublicProfile } from '@/core/social/community-posts-hooks';
import { useProfile } from '@/core/social/hooks';

export default function CommunityProfilePage() {
  const params = useParams();
  const userId = typeof params?.userId === 'string' ? params.userId : null;
  const { user } = useProfile();
  const { profile, loading, error } = useCommunityPublicProfile(userId);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto p-6">
        {loading ? <p className="text-sm text-text-secondary">Loading profile…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {profile ? <CommunityProfileCard profile={profile} currentUserId={user?.id ?? null} /> : null}
      </div>
    </AppShell>
  );
}
