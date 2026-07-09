/**
 * Resolves the playback URL for a video export.
 *
 * Video files are too large for the Vercel serverless proxy (4.5 MB limit).
 * They are served directly from the Render engine URL.
 *
 * Audio exports continue through the same-origin /api/exports/:id proxy.
 * This separation is intentional and documented.
 */
export function getVideoExportUrl(exportId: string): string {
  const engineBaseUrl = (
    process.env.NEXT_PUBLIC_ENGINE_URL || 'https://astradio-mvp-archive.onrender.com'
  ).replace(/\/$/, '');

  return `${engineBaseUrl}/api/exports/${encodeURIComponent(exportId)}?format=mp4`;
}
