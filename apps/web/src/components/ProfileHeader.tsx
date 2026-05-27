'use client';

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
    <header className="rounded-xl border border-border bg-surface-1 p-5 space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-20 h-20 rounded-full bg-bgElev border border-border flex items-center justify-center overflow-hidden shrink-0">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-2xl font-semibold text-text">{initial}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <h1 className="text-2xl font-bold text-text">{user.displayName}</h1>
          {user.birthData ? <p className="text-sm text-subtext">{user.birthData}</p> : null}
        </div>

        {isOwnProfile && onEditProfile ? (
          <button
            type="button"
            onClick={onEditProfile}
            className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text hover:border-accent/50 transition-colors"
          >
            Edit profile
          </button>
        ) : null}
      </div>

      {user.bio ? (
        <div className="border-t border-border pt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">About</h2>
          <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{user.bio}</p>
        </div>
      ) : null}
    </header>
  );
}
