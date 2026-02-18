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
