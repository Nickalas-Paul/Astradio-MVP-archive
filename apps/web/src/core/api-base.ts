/**
 * Canonical API base URL for frontend (browser) calls.
 *
 * Dev:
 * - Default to http://localhost:4000 (engine) unless NEXT_PUBLIC_API_BASE_URL is set.
 *
 * Prod:
 * - Default to same-origin relative URLs (''), unless NEXT_PUBLIC_API_BASE_URL is set.
 */
export function getApiBaseUrl(): string {
  // On the server (SSR / Next API), always use same-origin.
  if (typeof window === 'undefined') return '';

  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (process.env.NODE_ENV === 'development') {
    return explicit || 'http://localhost:4000';
  }

  return explicit || '';
}
