/**
 * Headers required for Vercel → Render engine proxy (PROXY_SHARED_SECRET).
 */

export function engineProxyHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'x-proxy-secret': process.env.PROXY_SHARED_SECRET || '',
    ...extra,
  };
}

export function engineProxySessionHeaders(
  userId: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return engineProxyHeaders({
    'x-proxy-session-user-id': userId,
    ...extra,
  });
}
