/**
 * Authenticated per-user canonical transit context (for group daily anchor resolution).
 */

const express = require('express');
const pgStore = require('../../lib/pg-store');
const { validateCanonicalLocation, userTransitContextRowFingerprint } = require('../lib/canonical-location');

function requireCaller(req, res) {
  const userId = (req.headers['x-caller-user-id'] || req.query.userId || '').toString().trim();
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return userId;
}

function createUserTransitContextRouter() {
  const router = express.Router({ mergeParams: true });

  if (!process.env.POSTGRES_URL) {
    router.use((_req, res) => res.status(501).json({ error: 'transit_context_requires_postgres' }));
    return router;
  }

  router.put('/users/me/transit-context', express.json({ limit: '32kb' }), async (req, res) => {
    const callerUserId = requireCaller(req, res);
    if (!callerUserId) return;
    const v = validateCanonicalLocation(req.body);
    if (!v.ok) {
      return res.status(400).json({ error: v.error, code: v.code || 'VALIDATION_ERROR' });
    }
    try {
      const fp = userTransitContextRowFingerprint(v.location);
      const row = await pgStore.upsertUserTransitContext(callerUserId, v.location, fp);
      return res.status(200).json({
        ok: true,
        userId: row.userId,
        fingerprint: row.fingerprint,
        updatedAt: row.updatedAt,
      });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'upsert_failed' });
    }
  });

  return router;
}

module.exports = { createUserTransitContextRouter };
