/**
 * Community API — relational persistence only (no legacy social store).
 * Compatibility Search stays on separate routes; feed is POST /community/relational-feed only.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { optionalRequire } = require('../../lib/opt/optional');

let pgStore = null;
try {
  if (process.env.POSTGRES_URL) {
    pgStore = require('../../lib/pg-store');
  }
} catch (_) {
  pgStore = null;
}

const vnextRoot = path.join(__dirname, '..', '..', 'dist', 'vnext', 'vnext');
const communityRelFeedMod = optionalRequire(path.join(vnextRoot, 'api', 'community-relational-feed'));

const REPORT_BODY_MAX = 500;

const communityPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests; try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

async function getDevUserId() {
  if (!pgStore) throw new Error('postgres_unavailable');
  const u = await pgStore.ensureDevUser();
  return u.id;
}

function queryUserId(req) {
  const q = req.query?.userId != null ? String(req.query.userId).trim() : '';
  return q || null;
}

function bodyUserId(body) {
  const b = body?.userId != null ? String(body.userId).trim() : '';
  return b || null;
}

async function resolveCommunityUserId(req, body) {
  return queryUserId(req) || bodyUserId(body || {}) || (await getDevUserId());
}

const router = express.Router({ mergeParams: true });

/**
 * POST /api/community/relational-feed
 * Body: { userId?, transit: { date, time, lat, lon, timezone? } }
 */
router.post('/community/relational-feed', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore || !communityRelFeedMod?.buildCommunityRelationalFeed || !communityRelFeedMod?.parseCommunityFeedTransit) {
      return res.status(501).json({ error: 'relational_feed_unavailable' });
    }
    const body = req.body || {};
    const userId = await resolveCommunityUserId(req, body);
    const transit = communityRelFeedMod.parseCommunityFeedTransit(body.transit);
    if (!transit) {
      return res.status(400).json({
        error: 'transit_required',
        message: 'transit must be { date, time, lat, lon, timezone? }',
      });
    }
    const payload = await communityRelFeedMod.buildCommunityRelationalFeed({
      userId,
      transitInput: transit,
      pgStore,
    });
    return res.status(200).json(payload);
  } catch (e) {
    console.error('[community] POST /community/relational-feed', e);
    return res.status(500).json({ error: e?.message || 'relational_feed_failed' });
  }
});

router.post('/community/connect-intent', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'Connection intent storage unavailable' });
    const body = req.body || {};
    const fromUserId = (body.fromUserId && String(body.fromUserId).trim()) || '';
    const toUserId = (body.toUserId && String(body.toUserId).trim()) || '';
    const fromChartId = (body.fromChartId && String(body.fromChartId).trim()) || '';
    const toChartId = (body.toChartId && String(body.toChartId).trim()) || '';
    const label = (body.label && String(body.label).trim()) || undefined;
    const relationshipKind = (body.relationshipKind && String(body.relationshipKind).trim().toLowerCase()) || 'friend';
    if (!fromUserId || !toUserId || !fromChartId || !toChartId) {
      return res.status(400).json({ error: 'fromUserId, toUserId, fromChartId, and toChartId required' });
    }
    if (fromUserId === toUserId) return res.status(400).json({ error: 'cannot connect to self' });
    const cFrom = await pgStore.getChart(fromChartId);
    const cTo = await pgStore.getChart(toChartId);
    if (!cFrom || !cTo) return res.status(404).json({ error: 'chart_not_found' });
    if (cFrom.ownerId !== fromUserId) return res.status(403).json({ error: 'from_chart_not_owned' });
    if (cTo.ownerId !== toUserId) return res.status(403).json({ error: 'to_chart_not_owned' });
    const intent = await pgStore.createConnectionIntent({
      fromUserId,
      toUserId,
      fromChartId,
      toChartId,
      label,
      relationshipKind,
    });
    return res.status(201).json(intent);
  } catch (e) {
    if (e && e.code === 'mirror_pending') {
      return res.status(409).json({ error: 'mirror_pending' });
    }
    console.error('[community] POST /community/connect-intent', e);
    return res.status(500).json({ error: e?.message || 'Failed to create connection intent' });
  }
});

router.post('/community/connection-intents/:intentId/decline', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const intentId = (req.params.intentId || '').trim();
    const body = req.body || {};
    const userId = (body.userId && String(body.userId).trim()) || (await getDevUserId());
    if (!userId) return res.status(401).json({ error: 'userId required' });
    const result = await pgStore.declineConnectionIntent(intentId, userId);
    if (!result.ok) {
      if (result.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
      return res.status(400).json({ error: result.error || 'decline_failed' });
    }
    return res.status(200).json(result);
  } catch (e) {
    console.error('[community] POST /community/connection-intents/:id/decline', e);
    return res.status(500).json({ error: e?.message || 'decline failed' });
  }
});

router.post('/community/connection-intents/:intentId/cancel', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const intentId = (req.params.intentId || '').trim();
    const body = req.body || {};
    const userId = (body.userId && String(body.userId).trim()) || (await getDevUserId());
    if (!userId) return res.status(401).json({ error: 'userId required' });
    const result = await pgStore.cancelConnectionIntent(intentId, userId);
    if (!result.ok) {
      if (result.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
      return res.status(400).json({ error: result.error || 'cancel_failed' });
    }
    return res.status(200).json(result);
  } catch (e) {
    console.error('[community] POST /community/connection-intents/:id/cancel', e);
    return res.status(500).json({ error: e?.message || 'cancel failed' });
  }
});

router.get('/community/signals', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const userId = queryUserId(req) || (await getDevUserId());
    const items = await pgStore.listSignalsForRecipient(userId);
    return res.json({ version: 'signals_v1', items });
  } catch (e) {
    console.error('[community] GET /community/signals', e);
    return res.status(500).json({ error: e?.message || 'signals_failed' });
  }
});

router.post('/community/signals/:signalId/react', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const signalId = (req.params.signalId || '').trim();
    const body = req.body || {};
    const userId = (body.userId && String(body.userId).trim()) || (await getDevUserId());
    if (!userId) return res.status(401).json({ error: 'userId required' });
    const result = await pgStore.reactToSignal(signalId, userId);
    if (!result.ok) {
      if (result.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
      if (result.error === 'signals_table_missing') return res.status(501).json({ error: 'signals_unavailable' });
      return res.status(400).json({ error: result.error || 'react_failed' });
    }
    return res.status(200).json(result);
  } catch (e) {
    console.error('[community] POST /community/signals/:id/react', e);
    return res.status(500).json({ error: e?.message || 'react failed' });
  }
});

router.post('/community/connection-intents/:intentId/accept', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const intentId = (req.params.intentId || '').trim();
    const body = req.body || {};
    const userId = (body.userId && String(body.userId).trim()) || (await getDevUserId());
    if (!userId) return res.status(401).json({ error: 'userId required' });
    const result = await pgStore.acceptConnectionIntent(intentId, userId);
    if (!result.ok) {
      if (result.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
      return res.status(400).json({ error: result.error || 'accept_failed' });
    }
    return res.status(200).json(result);
  } catch (e) {
    console.error('[community] POST /community/connection-intents/:id/accept', e);
    return res.status(500).json({ error: e?.message || 'accept failed' });
  }
});

router.get('/community/connection-intents/incoming', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const userId = queryUserId(req) || (await getDevUserId());
    const intents = await pgStore.listPendingIncomingConnectionIntents(userId);
    return res.json({ intents });
  } catch (e) {
    console.error('[community] GET connection-intents/incoming', e);
    return res.status(500).json({ error: e?.message || 'list failed' });
  }
});

async function enrichRelationshipForViewer(rel, viewerUserId) {
  const cLo = await pgStore.getChart(rel.chartIdLow);
  const cHi = await pgStore.getChart(rel.chartIdHigh);
  let peerUserId = null;
  let peerChartId = null;
  if (cLo && cHi) {
    if (cLo.ownerId === viewerUserId && cHi.ownerId !== viewerUserId) {
      peerChartId = rel.chartIdHigh;
      peerUserId = cHi.ownerId;
    } else if (cHi.ownerId === viewerUserId && cLo.ownerId !== viewerUserId) {
      peerChartId = rel.chartIdLow;
      peerUserId = cLo.ownerId;
    }
  }
  let peerDisplayName;
  let peerHandle;
  if (peerUserId) {
    const u = await pgStore.getUser(peerUserId);
    peerDisplayName = u?.displayName;
    peerHandle = u?.handle;
  }
  let hasCompositeArtifact = false;
  try {
    if (pgStore.listCompositeArtifactsByBinding) {
      const rows = await pgStore.listCompositeArtifactsByBinding({
        ownerUserId: viewerUserId,
        kind: 'pair',
        relationshipId: rel.id,
      });
      hasCompositeArtifact = Array.isArray(rows) && rows.length > 0;
    }
  } catch (_) {
    hasCompositeArtifact = false;
  }
  const artifactStatus =
    rel.comparisonId && hasCompositeArtifact ? 'available' : 'not_generated';
  return {
    ...rel,
    peerUserId,
    peerChartId,
    peerDisplayName,
    peerHandle,
    artifactStatus,
    hasCompositeArtifact,
  };
}

router.get('/community/inventory', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'inventory requires postgres' });
    const userId = queryUserId(req) || (await getDevUserId());
    const relationshipsRaw = await pgStore.listRelationshipsByOwner(userId);
    const pairs = [];
    for (const rel of relationshipsRaw) {
      // eslint-disable-next-line no-await-in-loop
      pairs.push(await enrichRelationshipForViewer(rel, userId));
    }
    const relationalGroups = await pgStore.listRelationalGroupsAccessibleToUser(userId);
    const campaigns = await pgStore.listStage5CampaignsByOwnerOrParticipant(userId);
    const pendingIncomingIntents = await pgStore.listPendingIncomingConnectionIntents(userId);
    const pendingOutgoingIntents = await pgStore.listPendingOutgoingConnectionIntents(userId);
    const pendingRelationalGroupInvites = await pgStore.listPendingRelationalGroupInvitesForInvitee(userId);

    const feedSkeleton = [];
    for (const p of pairs) {
      feedSkeleton.push({
        kind: 'pair',
        bindingId: p.id,
        feedKey: `pair:${p.id}`,
      });
    }
    for (const g of relationalGroups) {
      feedSkeleton.push({
        kind: 'relational_group',
        bindingId: g.id,
        feedKey: `relational_group:${g.id}`,
      });
    }
    for (const c of campaigns) {
      feedSkeleton.push({
        kind: 'campaign',
        bindingId: c.campaignId,
        feedKey: `campaign:${c.campaignId}`,
      });
    }
    feedSkeleton.sort((a, b) => String(a.feedKey).localeCompare(String(b.feedKey), 'en'));

    return res.json({
      version: 'community_inventory_v1',
      userId,
      pairs,
      relationalGroups,
      campaigns,
      pendingIncomingIntents,
      pendingOutgoingIntents,
      pendingRelationalGroupInvites,
      feedSkeleton,
    });
  } catch (e) {
    console.error('[community] GET /community/inventory', e);
    return res.status(500).json({ error: e?.message || 'inventory failed' });
  }
});

router.get('/community/guidance', (_req, res) => {
  res.json({
    banner: 'Public space. No harassment. No hate. No exclusionary or inflammatory topics.',
  });
});

/** Relational group detail (viewer must be owner or member). */
router.get('/community/relational-group/:idOrSlug', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'postgres required' });
    const userId = queryUserId(req) || (await getDevUserId());
    const idOrSlug = req.params.idOrSlug;
    const group = await pgStore.resolveRelationalGroupForScope(idOrSlug, userId);
    if (!group) return res.status(404).json({ error: 'not_found' });
    const members = await pgStore.listRelationalGroupMembersForScope(group.id, userId);
    return res.status(200).json({
      ...group,
      memberCount: Array.isArray(members) ? members.length : 0,
    });
  } catch (e) {
    console.error('[community] GET /community/relational-group/:idOrSlug', e);
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

/** Member roster for relational group (viewer must be owner or member). */
router.get('/community/relational-group/:id/members', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'postgres required' });
    const userId = queryUserId(req) || (await getDevUserId());
    const groupId = req.params.id;
    const membersRaw = await pgStore.listRelationalGroupMembersForScope(groupId, userId);
    if (membersRaw === undefined) return res.status(404).json({ error: 'not_found' });
    const members = await Promise.all(
      membersRaw.map(async (m) => {
        const uid = m.userId;
        const u = uid ? await pgStore.getUser(uid) : null;
        return {
          userId: uid || `non_platform:${m.chartId}`,
          chartId: m.chartId,
          displayName: u?.displayName || u?.handle || uid || m.chartId,
          handle: u?.handle,
        };
      })
    );
    return res.json({ members });
  } catch (e) {
    console.error('[community] GET /community/relational-group/:id/members', e);
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

router.post('/community/report', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'reports require postgres' });
    const body = req.body || {};
    const targetType = body.targetType;
    const targetId = body.targetId;
    const reason = body.reason;
    const note = (body.note != null ? String(body.note) : '').trim();
    if (!targetType || !targetId || !reason) {
      return res.status(400).json({ error: 'targetType, targetId, and reason required' });
    }
    if (note.length > REPORT_BODY_MAX) return res.status(400).json({ error: `note max ${REPORT_BODY_MAX} characters` });
    const report = await pgStore.createReport({ targetType, targetId, reason, note: note || null });
    return res.status(201).json({ id: report.id, createdAt: report.createdAt });
  } catch (e) {
    console.error('[community] POST /community/report', e);
    return res.status(500).json({ error: e?.message || 'Failed to create report' });
  }
});

module.exports = {
  communityRouter: router,
  COMMUNITY_GUIDANCE_BANNER:
    'Public space. No harassment. No hate. No exclusionary or inflammatory topics.',
};
