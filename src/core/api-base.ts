/**
 * Canonical API base URL for frontend (browser) calls to the backend.
 * - Set NEXT_PUBLIC_API_BASE_URL on Vercel to the Render backend URL (no trailing slash).
 * - When unset (local dev), returns '' so relative /api/* hits Next rewrites → backend.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  return typeof base === 'string' ? base.replace(/\/$/, '') : '';
}
