/**
 * Community API — relational persistence only (no legacy social store).
 * Compatibility Search stays on separate routes; feed is POST /community/relational-feed only.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const crypto = require('crypto');
const { optionalRequire } = require('../../lib/opt/optional');
const {
  COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
  readRelationalExpressionVersionFromDailyArtifact,
  buildRelationalFreshness,
} = require('../../lib/community-artifact-freshness');

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
const { createExportStore } = require('../../lib/export-store');

const REPORT_BODY_MAX = 500;

let communityExportStoreSingleton = null;
function getCommunityExportStore() {
  if (!communityExportStoreSingleton) {
    communityExportStoreSingleton = createExportStore();
  }
  return communityExportStoreSingleton;
}

async function exportReachableOnServer(exportId) {
  const id = String(exportId || '').trim();
  if (!id || !/^[a-f0-9]{64}$/.test(id)) return false;
  try {
    return await getCommunityExportStore().exists(id);
  } catch (_) {
    return false;
  }
}

function logRelationalWeatherRepairAttempt(payload) {
  console.log(
    '[community][relational-weather-repair]',
    JSON.stringify({
      libraryId: payload.libraryId,
      dailyArtifactIdUsed: payload.dailyArtifactIdUsed ?? null,
      textPayloadPresent: !!payload.textPayloadPresent,
      updateExecuted: !!payload.updateExecuted,
      exportReachable: !!payload.exportReachable,
      repairReason: payload.repairReason || null,
      objectIdentityHashPrefix: payload.objectIdentityHashPrefix || null,
    })
  );
}

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

router.get('/community/search', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const userId = queryUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const q = req.query.q != null ? String(req.query.q).trim() : '';
    if (q.length < 2) {
      return res.json({ q, users: [] });
    }
    const users = await pgStore.searchUsers(q, userId);
    return res.json({ q, users });
  } catch (e) {
    console.error('[community] GET /community/search', e);
    return res.status(500).json({ error: e?.message || 'search failed' });
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

router.get('/community/signals/sent', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const userId = queryUserId(req) || (await getDevUserId());
    const items = await pgStore.listSignalsForSender(userId);
    return res.json({ version: 'signals_v1', items });
  } catch (e) {
    console.error('[community] GET /community/signals/sent', e);
    return res.status(500).json({ error: e?.message || 'signals_sent_failed' });
  }
});

router.get('/community/signals/history', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const userId = queryUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const peerUserId = String(req.query.peerUserId || '').trim();
    if (!peerUserId) return res.status(400).json({ error: 'peerUserId required' });
    if (peerUserId === userId) return res.status(400).json({ error: 'invalid_peer' });
    const signals = await pgStore.getSignalHistoryForConnection(userId, peerUserId);
    const summary = await pgStore.getSignalHistorySummary(userId, peerUserId, signals);
    return res.json({ version: 'signals_history_v1', summary, signals });
  } catch (e) {
    console.error('[community] GET /community/signals/history', e);
    return res.status(500).json({ error: e?.message || 'signals_history_failed' });
  }
});

router.get('/community/signals/recent', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const userId = queryUserId(req);
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const limitRaw = parseInt(String(req.query.limit || '5'), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 5;
    const items = await pgStore.getRecentAcknowledgedSignals(userId, limit);
    return res.json({ version: 'signals_recent_v1', items });
  } catch (e) {
    console.error('[community] GET /community/signals/recent', e);
    return res.status(500).json({ error: e?.message || 'signals_recent_failed' });
  }
});

router.post('/community/signals', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const body = req.body || {};
    const senderUserId = (body.userId && String(body.userId).trim()) || (await getDevUserId());
    if (!senderUserId) return res.status(401).json({ error: 'userId required' });

    const result = await pgStore.createSignal({
      senderUserId,
      recipientUserId: body.recipientUserId,
      anchorType: body.anchorType,
      anchorId: body.anchorId,
      templateId: body.templateId,
      bodyJson: body.bodyJson,
    });

    if (!result.ok) {
      if (result.error === 'already_sent_today') {
        return res.status(409).json({ error: 'already_sent_today' });
      }
      if (result.error === 'self_signal') {
        return res.status(400).json({ error: 'cannot_signal_self' });
      }
      if (result.error === 'signals_table_missing') {
        return res.status(501).json({ error: 'signals_unavailable' });
      }
      if (result.error === 'invalid_template' || result.error === 'invalid_anchor_type') {
        return res.status(400).json({ error: result.error });
      }
      return res.status(400).json({ error: result.error || 'create_failed' });
    }

    return res.status(201).json({ signal: result.signal });
  } catch (e) {
    console.error('[community] POST /community/signals', e);
    return res.status(500).json({ error: e?.message || 'create signal failed' });
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

/**
 * Picks one group composite row: prefer reading_snapshot NOT NULL, then latest created_at.
 * @param {Array<{ group_id: string, reading_snapshot: unknown, export_job_id: unknown, created_at: string, id: string }>} rows
 * @param {string} groupId
 */
function selectGroupCompositeForInventory(rows, groupId) {
  const g = String(groupId);
  const forG = rows.filter((r) => r && String(r.group_id) === g && r.reading_snapshot != null);
  if (forG.length === 0) return null;
  forG.sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return tb - ta;
  });
  return forG[0];
}

function groupArtifactStatusFromRow(row) {
  if (!row) {
    return { artifactStatus: 'not_generated', exportJobId: null, compositeArtifactId: null };
  }
  const ex = row.export_job_id != null && String(row.export_job_id).trim() ? String(row.export_job_id) : null;
  if (ex) {
    return { artifactStatus: 'audio_available', exportJobId: ex, compositeArtifactId: String(row.id) };
  }
  return { artifactStatus: 'text_available', exportJobId: null, compositeArtifactId: String(row.id) };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildCommunityRelationalWeatherObjectIdentityHash(input) {
  return crypto.createHash('sha256').update(canonicalJson(input), 'utf8').digest('hex');
}

async function enrichRelationshipForViewer(rel, viewerUserId, exportByComparisonId) {
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
  const cmpKey = rel.comparisonId ? String(rel.comparisonId).trim() : '';
  const fromMap = cmpKey && exportByComparisonId ? exportByComparisonId.get(cmpKey) : null;
  const exportJobId = fromMap && String(fromMap).trim() ? String(fromMap) : null;
  let artifactStatus = 'not_generated';
  if (rel.comparisonId) {
    artifactStatus = exportJobId ? 'audio_available' : 'text_available';
  }
  return {
    ...rel,
    peerUserId,
    peerChartId,
    peerDisplayName,
    peerHandle,
    exportJobId,
    artifactStatus,
  };
}

router.get('/community/inventory', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'inventory requires postgres' });
    const userId = queryUserId(req) || (await getDevUserId());
    const relationshipsRaw = await pgStore.listRelationshipsByOwner(userId);
    const compIds = relationshipsRaw.map((r) => r.comparisonId).filter((id) => id && String(id).trim());
    const exportByComparisonId = await pgStore.getExportJobIdsForComparisonIds(compIds);
    const pairs = [];
    for (const rel of relationshipsRaw) {
      // eslint-disable-next-line no-await-in-loop
      pairs.push(await enrichRelationshipForViewer(rel, userId, exportByComparisonId));
    }
    const relationalGroupsBase = await pgStore.listRelationalGroupsAccessibleToUser(userId);
    const ownerGroupPairs = relationalGroupsBase.map((g) => ({ ownerId: g.ownerId, groupId: g.id }));
    const groupCompRows = await pgStore.getGroupCompositeRowsForGroupOwnerPairs(ownerGroupPairs);
    const relationalGroups = relationalGroupsBase.map((g) => {
      const row = selectGroupCompositeForInventory(groupCompRows, g.id);
      const st = groupArtifactStatusFromRow(row);
      return {
        ...g,
        artifactStatus: st.artifactStatus,
        exportJobId: st.exportJobId,
        compositeArtifactId: st.compositeArtifactId,
      };
    });
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

/**
 * Read-only stored group composite (reading_snapshot, export id reference) for scoped users.
 * No generation — queries existing astradio_composite_artifacts only.
 */
router.get('/community/relational-group/:idOrSlug/stored-artifact', async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'postgres required' });
    const userId = queryUserId(req) || (await getDevUserId());
    const idOrSlug = req.params.idOrSlug;
    const group = await pgStore.resolveRelationalGroupForScope(idOrSlug, userId);
    if (!group) return res.status(404).json({ error: 'not_found' });
    const ownerGroupPairs = [{ ownerId: group.ownerId, groupId: group.id }];
    const groupCompRows = await pgStore.getGroupCompositeRowsForGroupOwnerPairs(ownerGroupPairs);
    const row = selectGroupCompositeForInventory(groupCompRows, group.id);
    const st = groupArtifactStatusFromRow(row);
    const readingSnapshot = row && row.reading_snapshot != null ? row.reading_snapshot : null;
    return res.status(200).json({
      groupId: group.id,
      readingSnapshot,
      exportJobId: st.exportJobId,
      compositeArtifactId: st.compositeArtifactId,
      artifactStatus: st.artifactStatus,
    });
  } catch (e) {
    console.error('[community] GET /community/relational-group/:idOrSlug/stored-artifact', e);
    return res.status(500).json({ error: e?.message || 'failed' });
  }
});

router.post('/community/artifacts/save', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const body = req.body || {};
    const userId = await resolveCommunityUserId(req, body);
    const scopeKindRaw = String(body.scopeKind || '').trim();
    const scopeKind = scopeKindRaw === 'pair' || scopeKindRaw === 'group' ? scopeKindRaw : null;
    if (!scopeKind) return res.status(400).json({ error: 'scope_kind_required' });
    const bindingId = String(body.bindingId || '').trim();
    if (!bindingId) return res.status(400).json({ error: 'binding_id_required' });
    const chartIdsOrdered = Array.isArray(body.chartIdsOrdered)
      ? Array.from(
          new Set(
            body.chartIdsOrdered
              .map((x) => String(x || '').trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, 'en'))
      : [];
    if (chartIdsOrdered.length < 2) return res.status(400).json({ error: 'chart_ids_ordered_required' });
    const chartIdsOrderedHash = String(body.chart_ids_ordered_hash || pgStore.hashChartIdsOrdered(chartIdsOrdered)).trim();
    const canonicalDayBucket = String(body.canonical_day_bucket || '').trim();
    if (!chartIdsOrderedHash || !canonicalDayBucket) return res.status(400).json({ error: 'daily_identity_required' });
    const renderedArtifact =
      body.renderedArtifact && typeof body.renderedArtifact === 'object' && !Array.isArray(body.renderedArtifact)
        ? body.renderedArtifact
        : {};
    const planHash = String(renderedArtifact.planHash || body.planHash || '').trim() || null;
    const compositionId = String(renderedArtifact.compositionId || body.compositionId || '').trim() || null;
    const exportJobId = String(renderedArtifact.exportJobId || body.exportJobId || '').trim() || null;
    const textRaw = renderedArtifact.text != null ? renderedArtifact.text : body.text;
    const incomingText =
      typeof textRaw === 'string'
        ? textRaw.trim() || null
        : textRaw && typeof textRaw === 'object'
          ? textRaw
          : null;

    const objectIdentityHash = buildCommunityRelationalWeatherObjectIdentityHash({
      kind: 'community_relational_weather',
      scopeKind,
      bindingId,
      chartIdsOrdered,
      chartIdsOrderedHash,
      canonicalDayBucket,
      dailyArtifactId: String(body.daily_artifact_id || '').trim() || null,
      planHash: planHash || null,
      compositionId: compositionId || null,
    });
    let participantUserIds = [];
    let relationshipId = null;
    let groupId = null;

    if (scopeKind === 'pair') {
      relationshipId = String(body.relationshipId || bindingId).trim();
      const relationship = await pgStore.getRelationshipById(relationshipId);
      if (!relationship) return res.status(404).json({ error: 'relationship_not_found' });
      const charts = [relationship.chartIdLow, relationship.chartIdHigh].sort((a, b) => String(a).localeCompare(String(b), 'en'));
      if (charts[0] !== chartIdsOrdered[0] || charts[1] !== chartIdsOrdered[1]) {
        return res.status(400).json({ error: 'chart_scope_mismatch' });
      }
      const lowChart = await pgStore.getChart(relationship.chartIdLow);
      const highChart = await pgStore.getChart(relationship.chartIdHigh);
      participantUserIds = Array.from(
        new Set(
          [lowChart?.ownerId, highChart?.ownerId]
            .map((x) => (typeof x === 'string' ? x.trim() : ''))
            .filter(Boolean)
        )
      );
      if (!participantUserIds.includes(userId)) return res.status(403).json({ error: 'forbidden' });
    } else {
      const group = await pgStore.resolveRelationalGroupForScope(bindingId, userId);
      if (!group) return res.status(404).json({ error: 'group_not_found' });
      groupId = group.id;
      const members = await pgStore.listRelationalGroupMembers(group.id, group.ownerId);
      if (!members) return res.status(404).json({ error: 'group_not_found' });
      const platformMembers = members
        .map((m) => (typeof m.userId === 'string' ? m.userId.trim() : ''))
        .filter(Boolean);
      participantUserIds = Array.from(new Set([group.ownerId, ...platformMembers].filter(Boolean)));
      if (!participantUserIds.includes(userId)) return res.status(403).json({ error: 'forbidden' });
    }

    const existingDaily = await pgStore.getCommunityRelationalWeatherDailyArtifactByIdentity({
      scopeKind,
      bindingId,
      chartIdsOrderedHash,
      canonicalDayBucket,
    });
    if (!existingDaily) {
      return res.status(404).json({ error: 'artifact_not_found_for_identity' });
    }
    if (
      String(existingDaily.transitSnapshotHash || '').trim() !==
      String(body.transit_snapshot_hash || '').trim()
    ) {
      return res.status(409).json({ error: 'artifact_identity_mismatch' });
    }
    const dailyExpressionVersion = readRelationalExpressionVersionFromDailyArtifact(existingDaily);
    const dailyFreshness = buildRelationalFreshness(
      COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
      dailyExpressionVersion
    );

    const effectiveText =
      incomingText != null ? incomingText : existingDaily.textPayload != null ? existingDaily.textPayload : null;

    const resolvedExportJobId = existingDaily.exportJobId || exportJobId;
    const weatherPayload = body.weather && typeof body.weather === 'object' ? body.weather : null;
    const saved = await pgStore.ensureCommunityRelationalWeatherLibraryEntryForUser({
      ownerUserId: userId,
      scopeKind,
      bindingId,
      relationshipId,
      groupId,
      chartIdsOrdered,
      chartIdsOrderedHash,
      canonicalDayBucket,
      transitSnapshotHash: existingDaily.transitSnapshotHash,
      relationalWeatherStateHash: existingDaily.relationalWeatherStateHash,
      objectIdentityHash,
      dailyArtifactId: existingDaily.id,
      planHash: existingDaily.planHash || planHash,
      compositionId: existingDaily.compositionId || compositionId,
      exportJobId: resolvedExportJobId,
      text: effectiveText,
      weather: weatherPayload,
      expressionVersion: dailyFreshness.artifactVersion || dailyFreshness.currentVersion,
      historicalReason: dailyFreshness.isHistorical ? dailyFreshness.reason : null,
    });

    const exportReachable = await exportReachableOnServer(resolvedExportJobId);
    let repairResult = { updated: false, reportTextUpdated: false };
    if (!saved.inserted) {
      repairResult = await pgStore.repairCommunityRelationalWeatherLibraryComposition({
        ownerUserId: userId,
        objectIdentityHash,
        text: effectiveText,
        weather: weatherPayload,
      });
    }

    const inserted = saved.inserted ? 1 : 0;
    const repaired = repairResult.updated ? 1 : 0;
    const textRepaired =
      saved.inserted && effectiveText != null
        ? 1
        : !saved.inserted && repairResult.reportTextUpdated
          ? 1
          : 0;

    let repairReason;
    if (saved.inserted) {
      repairReason = effectiveText != null ? 'inserted_new_with_effective_text' : 'inserted_new_no_text_source';
    } else if (repairResult.reportTextUpdated) {
      repairReason = 'duplicate_text_repaired';
    } else if (repairResult.updated) {
      repairReason = 'duplicate_report_weather_only';
    } else {
      repairReason = 'duplicate_no_report_change';
    }

    logRelationalWeatherRepairAttempt({
      libraryId: saved.id,
      dailyArtifactIdUsed: existingDaily.id,
      textPayloadPresent: existingDaily.textPayload != null,
      updateExecuted: saved.inserted || repairResult.updated,
      exportReachable,
      repairReason,
      objectIdentityHashPrefix: String(objectIdentityHash).slice(0, 12),
    });

    return res.status(200).json({
      ok: true,
      objectIdentityHash,
      freshness: dailyFreshness,
      inserted,
      repaired,
      textRepaired,
      exportReachable,
      repairReason,
    });
  } catch (e) {
    console.error('[community] POST /community/artifacts/save', e);
    return res.status(500).json({ error: e?.message || 'community_artifact_save_failed' });
  }
});

/**
 * POST /api/community/artifacts/repair — gated QA/admin repair for one library row.
 * Header: x-community-repair-token must match env COMMUNITY_REPAIR_TOKEN.
 */
router.post('/community/artifacts/repair', communityPostLimiter, async (req, res) => {
  try {
    if (!pgStore) return res.status(501).json({ error: 'storage unavailable' });
    const token = (process.env.COMMUNITY_REPAIR_TOKEN || '').trim();
    if (!token) return res.status(501).json({ error: 'repair_unconfigured', message: 'COMMUNITY_REPAIR_TOKEN not set' });
    const hdr = (req.headers['x-community-repair-token'] || '').toString().trim();
    if (hdr !== token) return res.status(403).json({ error: 'repair_forbidden' });

    const body = req.body || {};
    const userId = await resolveCommunityUserId(req, body);
    const libraryId = String(body.libraryId || '').trim();
    if (!libraryId) return res.status(400).json({ error: 'library_id_required' });

    const row = await pgStore.getSandboxCompositionByIdForOwner(libraryId, userId);
    if (!row) return res.status(404).json({ error: 'library_row_not_found' });
    const source = String(row.source || '').trim();
    if (source !== 'community_relational_weather') {
      return res.status(400).json({ error: 'unsupported_source', source });
    }

    const resolved = await pgStore.resolveDailyArtifactForLibraryRepair(row);
    const daily = resolved.daily;
    const effectiveText = daily && daily.textPayload != null ? daily.textPayload : null;
    const effectiveWeather =
      daily && daily.weatherPayload != null && typeof daily.weatherPayload === 'object' ? daily.weatherPayload : null;

    const objectIdentityHash = String(row.object_identity_hash || '').trim();
    if (!objectIdentityHash) {
      return res.status(400).json({ error: 'library_row_missing_identity_hash' });
    }

    const exportId = row.export_id != null && String(row.export_id).trim() ? String(row.export_id).trim() : null;
    const exportReachable = await exportReachableOnServer(exportId);

    let repairResult = { updated: false, reportTextUpdated: false };
    if (resolved.reason === 'ok' && daily && (effectiveText != null || effectiveWeather != null)) {
      repairResult = await pgStore.repairCommunityRelationalWeatherLibraryComposition({
        ownerUserId: userId,
        objectIdentityHash,
        text: effectiveText,
        weather: effectiveWeather,
      });
    }

    let repairReason;
    if (resolved.reason !== 'ok') {
      repairReason = `daily_resolve:${resolved.reason}`;
    } else if (!daily || (effectiveText == null && effectiveWeather == null)) {
      repairReason = 'no_text_or_weather_in_daily';
    } else if (repairResult.reportTextUpdated) {
      repairReason = 'text_repaired_from_daily';
    } else if (repairResult.updated) {
      repairReason = 'weather_only_updated';
    } else {
      repairReason = 'no_report_change';
    }

    logRelationalWeatherRepairAttempt({
      libraryId,
      dailyArtifactIdUsed: daily ? daily.id : null,
      textPayloadPresent: !!(daily && daily.textPayload != null),
      updateExecuted: repairResult.updated,
      exportReachable,
      repairReason,
      objectIdentityHashPrefix: objectIdentityHash.slice(0, 12),
    });

    return res.status(200).json({
      ok: true,
      libraryId,
      inserted: 0,
      repaired: repairResult.updated ? 1 : 0,
      textRepaired: repairResult.reportTextUpdated ? 1 : 0,
      exportReachable,
      repairReason,
      dailyResolutionPath: resolved.resolutionPath,
      dailyResolveReason: resolved.reason,
    });
  } catch (e) {
    console.error('[community] POST /community/artifacts/repair', e);
    return res.status(500).json({ error: e?.message || 'community_artifact_repair_failed' });
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
