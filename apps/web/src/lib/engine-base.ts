/**
 * Canonical engine base URL for Next.js API route proxies (server-side only).
 * Same env vars as /api/charts and /api/comparisons so Vercel Preview points at Render.
 */
export function getEngineBaseUrl(): string {
  return (process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
}
