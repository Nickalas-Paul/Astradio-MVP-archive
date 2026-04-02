/**
 * Phase 5 — Owner identity resolution for relational routes.
 * Production: ownerId ONLY from req.user.id (session).
 * Dev override: NODE_ENV === 'development' AND ALLOW_DEV_USER_FALLBACK=true.
 */

export interface RequestLike {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  user?: { id: string };
}

const DEV_GATE =
  process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_USER_FALLBACK === 'true';

/**
 * Resolve owner ID from request.
 * Prod: only req.user.id. Dev+gate: query.userId, body.userId, ensureDevUser fallback.
 */
export async function resolveOwnerId(req: RequestLike): Promise<string | undefined> {
  const u = req?.user;
  if (u && typeof u.id === 'string' && u.id.trim()) return u.id.trim();

  if (!DEV_GATE) return undefined;

  const q = (req?.query?.userId as string) || undefined;
  if (q && typeof q === 'string' && q.trim()) return q.trim();
  const b = (req?.body?.userId as string) || undefined;
  if (b && typeof b === 'string' && b.trim()) return b.trim();

  if (process.env.POSTGRES_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pgStore = require('../../../../lib/pg-store');
      if (pgStore?.ensureDevUser) {
        const dev = await pgStore.ensureDevUser();
        if (dev?.id) return String(dev.id).trim();
      }
    } catch {
      // ignore
    }
  }
  return undefined;
}

export function isDevGateEnabled(): boolean {
  return DEV_GATE;
}
