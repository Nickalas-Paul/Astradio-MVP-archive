'use client';

import { Button } from '@/components/shared/Button';
import { Card } from '@/components/shared/Card';

export interface ProfileHeaderUser {
  displayName: string;
  birthData?: string;
  bio?: string;
  photoUrl?: string;
}

export interface ProfileHeaderProps {
  user: ProfileHeaderUser;
  isOwnProfile: boolean;
  onEditProfile?: () => void;
}

export function ProfileHeader({ user, isOwnProfile, onEditProfile }: ProfileHeaderProps) {
  const initial = (user.displayName || '?').charAt(0).toUpperCase();

  return (
    <Card elevation="resting" padding="p-5" className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-20 h-20 rounded-full bg-surface-0 border border-border flex items-center justify-center overflow-hidden shrink-0">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="font-serif text-h3 font-semibold text-text-primary">{initial}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <h1 className="font-serif text-h2 font-semibold text-text-primary">{user.displayName}</h1>
          {user.birthData ? (
            <p className="text-body-sm text-text-secondary">{user.birthData}</p>
          ) : null}
        </div>

        {isOwnProfile && onEditProfile ? (
          <Button type="button" variant="outline" size="sm" onClick={onEditProfile}>
            Edit profile
          </Button>
        ) : null}
      </div>

      {user.bio ? (
        <div className="border-t border-border pt-4">
          <h2 className="text-caption font-medium uppercase tracking-wide text-text-secondary mb-2">
            About
          </h2>
          <p className="text-body text-text-secondary leading-relaxed whitespace-pre-wrap">{user.bio}</p>
        </div>
      ) : null}
    </Card>
  );
}
