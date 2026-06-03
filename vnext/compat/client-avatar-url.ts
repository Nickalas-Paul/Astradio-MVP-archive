/** Same-origin avatar URL for clients when a stored avatar exists (S3 may be private). */
export function clientAvatarUrl(userId: string, storedUrl?: string | null): string | undefined {
  if (!storedUrl || !String(storedUrl).trim()) return undefined;
  return `/api/profile/avatar/${encodeURIComponent(userId)}`;
}
