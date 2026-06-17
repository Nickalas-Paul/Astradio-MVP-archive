export interface CommunityAuthor {
  displayName?: string | null;
  handle?: string | null;
  avatarUrl?: string | null;
}

export function formatCommunityAuthorLabel(author?: CommunityAuthor | null): string {
  const handle = author?.handle?.trim().replace(/^@/, '') || '';
  const displayName = author?.displayName?.trim() || '';
  if (displayName && handle) return `${displayName} @${handle}`;
  if (displayName) return displayName;
  if (handle) return `@${handle}`;
  return 'Anonymous';
}

export function communityAuthorInitial(author?: CommunityAuthor | null): string {
  const label = author?.displayName?.trim() || author?.handle?.trim().replace(/^@/, '') || '';
  return label ? label.charAt(0).toUpperCase() : '?';
}
