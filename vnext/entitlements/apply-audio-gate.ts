import type { AudioGateResult } from './types';
import { canGenerateAudio } from './can-generate-audio';

export function resolveSessionUserId(req: {
  user?: { id?: string };
  headers?: Record<string, unknown>;
  body?: { userId?: string };
}): string | null {
  const u = req.user;
  if (u && typeof u.id === 'string' && u.id.trim()) return u.id.trim();
  const fromHeader = (req.headers?.['x-proxy-session-user-id'] || '').toString().trim();
  if (fromHeader) return fromHeader;
  const fromBody = req.body?.userId;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody.trim();
  return null;
}

export function entitlementRequiredBody(result: Extract<AudioGateResult, { allowed: false }>) {
  return {
    error: 'Audio generation requires a subscription or tokens',
    code: 'ENTITLEMENT_REQUIRED',
    tokenBalance: result.tokenBalance,
    subscriptionStatus: result.subscriptionStatus,
  };
}

/**
 * Enforce audio entitlement for an HTTP handler. Returns gate result when allowed, or null after sending a response.
 */
export async function enforceAudioEntitlement(
  req: Parameters<typeof resolveSessionUserId>[0],
  res: { status: (code: number) => { json: (body: unknown) => unknown } }
): Promise<AudioGateResult | null> {
  const userId = resolveSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }

  const result = await canGenerateAudio(userId);
  console.info('[entitlement] audio gate', {
    userId,
    allowed: result.allowed,
    reason: result.reason,
  });

  if (!result.allowed) {
    res.status(402).json(entitlementRequiredBody(result));
    return null;
  }

  return result;
}
