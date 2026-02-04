/**
 * Canonical API base URL for frontend (browser) calls.
 * Always returns '' so the client uses same-origin relative URLs (/api/compose, /api/chart, /api/ip-geo).
 * Next API routes proxy to Render using API_BASE_URL server-side, avoiding CORS.
 * Do not set NEXT_PUBLIC_API_BASE_URL on Vercel; set API_BASE_URL only (server-side proxy target).
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return '';
}
