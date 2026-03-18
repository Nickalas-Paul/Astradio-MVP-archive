/**
 * Phase 8 Stage 5 — Tri-mode campaign routes (solo, group, auto).
 * Identity from session only (header/query set by proxy). Never trust body userId.
 * Single creation path; context_key unique; concurrency-safe.
 */

const crypto = require('crypto');
const express = require('express');
const path = require('path');

const pgStore = require('../../lib/pg-store');
const vectorStore = require('../../lib/vector-store');

const STAGE5_AUTO_PARTY_SIZE = 4;
const SCORING_VERSION = 'stage4_compat_v1';
const SELECTION_RULES_VERSION = 'party_max_4_v1';

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function canonicalSort(arr) {
  return Array.isArray(arr) ? [...arr].filter((x) => typeof x === 'string').sort((a, b) => a.localeCompare(b, 'en')) : [];
}

/** Caller identity from header or query only (set by Vercel proxy). Never from body. */
function requireCaller(req, res) {
  const userId = (req.headers['x-caller-user-id'] || req.query.userId || '').toString().trim();
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return userId;
}

/** 404 = not found or not visible; 400 = invalid input; 422 = business rule / missing dependency */
function notFound(res) {
  return res.status(404).json({ error: 'not_found' });
}
function badRequest(res, msg) {
  return res.status(400).json({ error: 'invalid_request', message: msg || 'Invalid request' });
}
function unprocessable(res, msg) {
  return res.status(422).json({ error: 'unprocessable', message: msg || 'Unprocessable' });
}

function createStage5Router() {
  const router = express.Router({ mergeParams: true });

  if (!process.env.POSTGRES_URL) {
    router.use((_req, res) => res.status(501).json({ error: 'stage5_requires_postgres' }));
    return router;
  }

  // ---------- SOLO context_key: owner_user_id + resolved_owner_chart_id + version_set (frozen at create) ----------
  async function resolveSoloContext(ownerUserId, body, res) {
    const chartId = await pgStore.getUserPrimaryChart(ownerUserId);
    if (!chartId) {
      unprocessable(res, 'No primary chart for owner');
      return null;
    }
    const natalSnapshot = body.natalSnapshot;
    let profile;
    try {
      const rpgStore = require(path.join(__dirname, '../../dist/vnext/vnext/rpg/store/rpg-store'));
      profile = await rpgStore.getOrCreateRpgProfileForChart({
        userId: ownerUserId,
        chartId,
        snapshot: natalSnapshot || { ts: '', tz: 'UTC', lat: 0, lon: 0, houseSystem: 'placidus', planets: [], houses: [], aspects: [], moonPhase: 0.5, dominantElements: { fire: 0.25, earth: 0.25, air: 0.25, water: 0.25 } },
      });
    } catch (e) {
      if (!natalSnapshot) {
        unprocessable(res, 'natalSnapshot required to create profile');
        return null;
      }
      unprocessable(res, e?.message || 'Profile resolution failed');
      return null;
    }
    const versionSet = {
      rpg_map_version: profile.rpg_map_version,
      rpg_algo_version: 'rpg-v1',
      audio_algo_version: 'audio-v1',
    };
    const contextKey = sha256(canonicalJson({ mode: 'solo', owner_user_id: ownerUserId, resolved_owner_chart_id: chartId, version_set: versionSet }));
    let bundleHash = profile.bundle_hash;
    let stateJson = {};
    let stateHash = sha256('{}');
    try {
      const stateMachine = require(path.join(__dirname, '../../dist/vnext/vnext/rpg/campaign/state-machine'));
      const rpgStoreMod = require(path.join(__dirname, '../../dist/vnext/vnext/rpg/store/rpg-store'));
      const bundleRow = await rpgStoreMod.getBundleByHash(profile.bundle_hash);
      if (bundleRow && bundleRow.bundle_json) {
        const initialState = stateMachine.initialCampaignState(bundleRow.bundle_json);
        stateJson = initialState;
        stateHash = sha256(canonicalJson(initialState));
      }
    } catch (_) {
      // keep default empty state
    }
    return {
      contextKey,
      mode: 'solo',
      ownerUserId,
      participantUserIds: canonicalSort([ownerUserId]),
      participantChartIds: canonicalSort([chartId]),
      groupId: null,
      compositeArtifactId: null,
      bundleHash,
      stateJson,
      stateHash,
      versionSetJson: versionSet,
      autoResolutionSignature: null,
    };
  }

  // ---------- GROUP context: owner + group_id + sorted member chart_ids + composite_artifact_id + version_set ----------
  async function resolveGroupContext(ownerUserId, groupId, res) {
    const group = await pgStore.getRelationalGroupById(groupId);
    if (!group || group.ownerId !== ownerUserId) {
      notFound(res);
      return null;
    }
    const members = await pgStore.listRelationalGroupMembers(groupId, ownerUserId);
    if (!members || members.length === 0) {
      unprocessable(res, 'Group has no members');
      return null;
    }
    const chartIds = canonicalSort([...new Set(members.map((m) => m.chartId))]);
    const artifacts = await pgStore.listCompositeArtifactsByBinding({ ownerUserId: ownerUserId, kind: 'group', groupId });
    if (!artifacts || artifacts.length === 0) {
      unprocessable(res, 'No composite artifact for group; create group composite first');
      return null;
    }
    const artifact = artifacts[0];
    const versionSet = { rpg_map_version: 'v1', rpg_algo_version: 'rpg-v1', audio_algo_version: 'audio-v1' };
    const contextKey = sha256(
      canonicalJson({
        mode: 'group',
        owner_user_id: ownerUserId,
        group_id: groupId,
        resolved_member_chart_ids: chartIds,
        composite_artifact_id: artifact.id,
        version_set: versionSet,
      })
    );
    const participantUserIds = canonicalSort([...new Set(members.map((m) => m.userId).filter(Boolean))]);
    if (participantUserIds.length === 0) participantUserIds.push(ownerUserId);
    return {
      contextKey,
      mode: 'group',
      ownerUserId,
      participantUserIds,
      participantChartIds: chartIds,
      groupId,
      compositeArtifactId: artifact.id,
      bundleHash: null,
      stateJson: {},
      stateHash: sha256('{}'),
      versionSetJson: versionSet,
      autoResolutionSignature: null,
    };
  }

  // ---------- AUTO: pool = chart_ids from owner's groups with vectors; select first group that has composite; party = that group's members ----------
  async function resolveAutoContext(ownerUserId, res) {
    const groups = await pgStore.listRelationalGroupsByOwner(ownerUserId);
    const candidateChartIds = new Set();
    for (const g of groups) {
      const members = await pgStore.listRelationalGroupMembers(g.id, ownerUserId);
      if (members && members.length > 0) {
        for (const m of members) candidateChartIds.add(m.chartId);
      }
    }
    const allChartIds = canonicalSort([...candidateChartIds]);
    const vecMap = await vectorStore.getChartVectorsByIds(allChartIds);
    const withVector = allChartIds.filter((id) => vecMap.get(id) && Array.isArray(vecMap.get(id).vector64) && vecMap.get(id).vector64.length > 0);
    const poolSignature = sha256(
      canonicalSort(withVector).join(',') + SCORING_VERSION + SELECTION_RULES_VERSION
    );
    let selectedGroup = null;
    const sortedGroupIds = groups.map((g) => g.id).sort((a, b) => a.localeCompare(b, 'en'));
    for (const gid of sortedGroupIds) {
      const members = await pgStore.listRelationalGroupMembers(gid, ownerUserId);
      if (!members || members.length === 0 || members.length > STAGE5_AUTO_PARTY_SIZE) continue;
      const chartIds = canonicalSort(members.map((m) => m.chartId));
      const artifacts = await pgStore.listCompositeArtifactsByBinding({ ownerUserId, kind: 'group', groupId: gid });
      if (artifacts && artifacts.length > 0) {
        selectedGroup = { groupId: gid, members, chartIds, artifact: artifacts[0] };
        break;
      }
    }
    if (!selectedGroup) {
      unprocessable(res, 'No group with composite found for auto mode');
      return null;
    }
    const participantUserIds = canonicalSort([...new Set(selectedGroup.members.map((m) => m.userId).filter(Boolean))]);
    if (participantUserIds.length === 0) participantUserIds.push(ownerUserId);
    const autoResolutionSignature = sha256(
      canonicalSort(withVector).join(',') + SCORING_VERSION + SELECTION_RULES_VERSION
    );
    const versionSet = { rpg_map_version: 'v1', rpg_algo_version: 'rpg-v1', audio_algo_version: 'audio-v1' };
    const contextKey = sha256(
      canonicalJson({
        mode: 'auto',
        owner_user_id: ownerUserId,
        candidate_pool_signature: poolSignature,
        resolved_selected_participant_ids: selectedGroup.chartIds,
        composite_artifact_id: selectedGroup.artifact.id,
        version_set: versionSet,
      })
    );
    return {
      contextKey,
      mode: 'auto',
      ownerUserId,
      participantUserIds,
      participantChartIds: selectedGroup.chartIds,
      groupId: selectedGroup.groupId,
      compositeArtifactId: selectedGroup.artifact.id,
      bundleHash: null,
      stateJson: {},
      stateHash: sha256('{}'),
      versionSetJson: versionSet,
      autoResolutionSignature,
    };
  }

  // ---------- POST /api/campaigns/create ----------
  router.post('/campaigns/create', async (req, res) => {
    const callerUserId = requireCaller(req, res);
    if (!callerUserId) return;
    const body = req.body || {};
    const mode = (body.mode || '').toString().toLowerCase();
    if (!['solo', 'group', 'auto'].includes(mode)) {
      return badRequest(res, 'mode must be solo, group, or auto');
    }
    let ctx;
    if (mode === 'solo') {
      ctx = await resolveSoloContext(callerUserId, body, res);
    } else if (mode === 'group') {
      const groupId = (body.groupId || '').toString().trim();
      if (!groupId) return badRequest(res, 'groupId required for group mode');
      ctx = await resolveGroupContext(callerUserId, groupId, res);
    } else {
      ctx = await resolveAutoContext(callerUserId, res);
    }
    if (!ctx) return;
    try {
      const campaign = await pgStore.createStage5Campaign({
        contextKey: ctx.contextKey,
        mode: ctx.mode,
        ownerUserId: ctx.ownerUserId,
        participantUserIds: ctx.participantUserIds,
        participantChartIds: ctx.participantChartIds,
        groupId: ctx.groupId,
        compositeArtifactId: ctx.compositeArtifactId,
        bundleHash: ctx.bundleHash,
        stateJson: ctx.stateJson,
        stateHash: ctx.stateHash,
        versionSetJson: ctx.versionSetJson,
        autoResolutionSignature: ctx.autoResolutionSignature,
      });
      return res.status(201).json({
        campaignId: campaign.campaignId,
        contextKey: campaign.contextKey,
        mode: campaign.mode,
        ownerUserId: campaign.ownerUserId,
        participantUserIds: campaign.participantUserIds,
        participantChartIds: campaign.participantChartIds,
        groupId: campaign.groupId,
        compositeArtifactId: campaign.compositeArtifactId,
        stateVersion: campaign.stateVersion,
        createdAt: campaign.createdAt,
      });
    } catch (e) {
      if (e?.code === '23505') {
        const existing = await pgStore.getStage5CampaignByContextKey(ctx.contextKey);
        if (existing) return res.status(200).json({
          campaignId: existing.campaignId,
          contextKey: existing.contextKey,
          mode: existing.mode,
          ownerUserId: existing.ownerUserId,
          participantUserIds: existing.participantUserIds,
          participantChartIds: existing.participantChartIds,
          groupId: existing.groupId,
          compositeArtifactId: existing.compositeArtifactId,
          stateVersion: existing.stateVersion,
          createdAt: existing.createdAt,
        });
      }
      return res.status(500).json({ error: 'internal_error', message: e?.message || 'Create failed' });
    }
  });

  // ---------- GET /api/campaigns (query-level filter: owner or participant) ----------
  router.get('/campaigns', async (req, res) => {
    const callerUserId = requireCaller(req, res);
    if (!callerUserId) return;
    try {
      const list = await pgStore.listStage5CampaignsByOwnerOrParticipant(callerUserId);
      return res.status(200).json({ campaigns: list });
    } catch (e) {
      return res.status(500).json({ error: 'internal_error', message: e?.message || 'List failed' });
    }
  });

  // ---------- GET /api/campaigns/:id ----------
  router.get('/campaigns/:id', async (req, res) => {
    const callerUserId = requireCaller(req, res);
    if (!callerUserId) return;
    const id = (req.params.id || '').toString().trim();
    if (!id) return badRequest(res, 'id required');
    const campaign = await pgStore.getStage5CampaignById(id);
    if (!campaign) return notFound(res);
    if (campaign.ownerUserId !== callerUserId && !campaign.participantUserIds.includes(callerUserId)) {
      return notFound(res);
    }
    return res.status(200).json(campaign);
  });

  // ---------- POST /api/campaigns/:id/enter ----------
  router.post('/campaigns/:id/enter', async (req, res) => {
    const callerUserId = requireCaller(req, res);
    if (!callerUserId) return;
    const id = (req.params.id || '').toString().trim();
    if (!id) return badRequest(res, 'id required');
    const campaign = await pgStore.getStage5CampaignById(id);
    if (!campaign) return notFound(res);
    if (campaign.ownerUserId !== callerUserId && !campaign.participantUserIds.includes(callerUserId)) {
      return notFound(res);
    }
    return res.status(200).json({
      campaignId: campaign.campaignId,
      mode: campaign.mode,
      ownerUserId: campaign.ownerUserId,
      participantUserIds: campaign.participantUserIds,
      participantChartIds: campaign.participantChartIds,
      compositeArtifactId: campaign.compositeArtifactId,
      stateJson: campaign.stateJson,
      stateHash: campaign.stateHash,
      stateVersion: campaign.stateVersion,
    });
  });

  return router;
}

module.exports = { createStage5Router };
