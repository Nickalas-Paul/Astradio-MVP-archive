/**
 * Canonical engine base URL for Next.js API route proxies (server-side only).
 * Engine defaults to port 4000; Next.js runs on 3000.
 */
export function getEngineBaseUrl(): string {
  return (process.env.API_BASE_URL || process.env.ENGINE_BASE_URL || 'http://localhost:4000').replace(
    /\/$/,
    ''
  );
}

/**
 * Run compat/matches in-process (compiled vnext) so Vercel UI + bullets share one commit.
 * Set USE_EXTERNAL_ENGINE=1 or FORCE_ENGINE_PROXY=1 to keep proxying to Render.
 */
export function shouldUseInProcessCompatApi(): boolean {
  if (process.env.FORCE_ENGINE_PROXY === '1') return false;
  if (process.env.USE_EXTERNAL_ENGINE === '1') return false;
  if (process.env.USE_IN_PROCESS_VNEXT === '1') return true;
  if (process.env.VERCEL === '1') return true;
  return false;
}
