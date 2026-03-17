const crypto = require('crypto');
const express = require('express');

const pgStore = require('../../lib/pg-store');
const groupComposeAdapter = require('../../dist/vnext/vnext/relational/composition/group-compose-adapter');

function createStage4Router() {
  const router = express.Router({ mergeParams: true });

  function requireOwner(req, res) {
    const ownerUserId = (req.query.userId || req.body?.userId || '').toString().trim();
    if (!ownerUserId) {
      res.status(401).json({ error: 'unauthorized' });
      return null;
    }
    return ownerUserId;
  }

  async function assertOwnedChart(ownerUserId, chartId) {
    const chart = await pgStore.getChart(chartId);
    if (!chart || chart.ownerId !== ownerUserId) return false;
    return true;
  }

  async function assertOwnedCharts(ownerUserId, chartIds) {
    for (const id of chartIds) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await assertOwnedChart(ownerUserId, id);
      if (!ok) return false;
    }
    return true;
  }

  function canonicalPair(chartAId, chartBId) {
    const a = String(chartAId || '').trim();
    const b = String(chartBId || '').trim();
    if (!a || !b || a === b) return null;
    return a.localeCompare(b, 'en') <= 0 ? [a, b] : [b, a];
  }

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
      const keys = Object.keys(value).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  function artifactHashFromPayload(payload) {
    return crypto.createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
  }

  // Memory mode is explicitly unsupported for Stage 4.
  if (!process.env.POSTGRES_URL) {
    router.use((_req, res) => {
      return res.status(501).json({ error: 'stage4_requires_postgres' });
    });
    return router;
  }

  // Relationships
  router.post('/relationships', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const { chartAId, chartBId, label, comparisonId } = req.body || {};
      const pair = canonicalPair(chartAId, chartBId);
      if (!pair || !label || typeof label !== 'string' || !label.trim()) {
        return res.status(400).json({ error: 'validation_error' });
      }
      const [chartIdLow, chartIdHigh] = pair;
      const owned = await assertOwnedCharts(ownerUserId, [chartIdLow, chartIdHigh]);
      if (!owned) return res.status(404).json({ error: 'not_found' });
      const relationship = await pgStore.createRelationship({
        ownerUserId,
        chartAId: chartIdLow,
        chartBId: chartIdHigh,
        label: label.trim(),
        comparisonId: comparisonId || null,
      });
      return res.status(201).json(relationship);
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to create relationship' });
    }
  });

  router.get('/relationships', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const items = await pgStore.listRelationshipsByOwner(ownerUserId);
      return res.status(200).json({ items });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to list relationships' });
    }
  });

  router.get('/relationships/:id', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const relationship = await pgStore.getRelationshipById(req.params.id);
      if (!relationship || relationship.ownerUserId !== ownerUserId) {
        return res.status(404).json({ error: 'not_found' });
      }
      return res.status(200).json(relationship);
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to get relationship' });
    }
  });

  router.delete('/relationships/:id', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const ok = await pgStore.deleteRelationshipById(req.params.id, ownerUserId);
      if (!ok) return res.status(404).json({ error: 'not_found' });
      return res.status(204).send();
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to delete relationship' });
    }
  });

  router.get('/relationships/:id/composite', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const relationship = await pgStore.getRelationshipById(req.params.id);
      if (!relationship || relationship.ownerUserId !== ownerUserId) {
        return res.status(404).json({ error: 'not_found' });
      }
      const chartIds = [relationship.chartIdLow, relationship.chartIdHigh];
      const owned = await assertOwnedCharts(ownerUserId, chartIds);
      if (!owned) return res.status(404).json({ error: 'not_found' });

      const composed = await groupComposeAdapter.composeGroupFromChartIds(chartIds, { groupId: relationship.id });
      const artifactPayload = {
        kind: 'pair',
        owner_user_id: ownerUserId,
        relationship_id: relationship.id,
        chart_ids: chartIds,
        vector_hashes: composed.provenance.vector_hashes,
        seed: composed.provenance.seed,
        algorithm_version: composed.provenance.algorithm_version,
        plan_hash: composed.planHash,
        composition_id: composed.compositionId,
      };
      const artifactHash = artifactHashFromPayload(artifactPayload);
      let artifact = await pgStore.getCompositeArtifactByHash(ownerUserId, 'pair', artifactHash);
      if (!artifact) {
        artifact = await pgStore.createCompositeArtifact({
          ownerUserId,
          kind: 'pair',
          relationshipId: relationship.id,
          chartIds,
          vectorHashes: composed.provenance.vector_hashes,
          seed: composed.provenance.seed,
          algorithmVersion: composed.provenance.algorithm_version,
          planHash: composed.planHash,
          compositionId: composed.compositionId,
          artifactHash,
        });
      }
      return res.status(200).json({
        relationshipId: relationship.id,
        artifact,
      });
    } catch (e) {
      if (String(e?.message || '').includes('missing vectors')) {
        return res.status(422).json({ error: 'missing_vectors' });
      }
      return res.status(500).json({ error: e?.message || 'Failed to build relationship composite' });
    }
  });

  // Groups (Stage 4 constrained surface)
  router.post('/groups', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const { slug, name, description } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'validation_error' });
      }
      const group = await pgStore.createRelationalGroup({
        ownerId: ownerUserId,
        slug: slug ? String(slug).trim() : undefined,
        name: name.trim(),
        description: description ? String(description) : '',
      });
      return res.status(201).json(group);
    } catch (e) {
      const conflict = e?.code === '23505' || String(e?.message || '').toLowerCase().includes('unique');
      if (conflict) return res.status(409).json({ error: 'conflict' });
      return res.status(500).json({ error: e?.message || 'Failed to create group' });
    }
  });

  router.get('/groups', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const groups = await pgStore.listRelationalGroupsByOwner(ownerUserId);
      return res.status(200).json({ groups });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to list groups' });
    }
  });

  router.get('/groups/:id', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const group = await pgStore.getRelationalGroupById(req.params.id);
      if (!group || group.ownerId !== ownerUserId) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json(group);
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to get group' });
    }
  });

  router.post('/groups/:id/members', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const group = await pgStore.getRelationalGroupById(req.params.id);
      if (!group || group.ownerId !== ownerUserId) return res.status(404).json({ error: 'not_found' });
      const { chartId, role, label } = req.body || {};
      if (!chartId || typeof chartId !== 'string') return res.status(400).json({ error: 'validation_error' });
      const owned = await assertOwnedChart(ownerUserId, chartId.trim());
      if (!owned) return res.status(404).json({ error: 'not_found' });
      const member = await pgStore.addRelationalGroupMember({
        groupId: req.params.id,
        memberType: 'platform',
        userId: ownerUserId,
        chartId: chartId.trim(),
        role: role ? String(role) : 'member',
        label: label ? String(label) : null,
      });
      return res.status(201).json(member);
    } catch (e) {
      const conflict = e?.code === '23505' || String(e?.message || '').toLowerCase().includes('unique');
      if (conflict) return res.status(409).json({ error: 'conflict' });
      return res.status(500).json({ error: e?.message || 'Failed to add member' });
    }
  });

  router.delete('/groups/:id/members/:memberId', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const ok = await pgStore.removeRelationalGroupMember(req.params.id, req.params.memberId, ownerUserId);
      if (!ok) return res.status(404).json({ error: 'not_found' });
      return res.status(204).send();
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'Failed to remove member' });
    }
  });

  async function buildGroupComposite(req, res) {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const group = await pgStore.getRelationalGroupById(req.params.id);
      if (!group || group.ownerId !== ownerUserId) return res.status(404).json({ error: 'not_found' });
      const members = await pgStore.listRelationalGroupMembers(req.params.id, ownerUserId);
      if (!members || members.length === 0) return res.status(400).json({ error: 'validation_error' });
      const chartIds = Array.from(new Set(members.map((m) => m.chartId))).sort((a, b) => a.localeCompare(b, 'en'));
      const owned = await assertOwnedCharts(ownerUserId, chartIds);
      if (!owned) return res.status(404).json({ error: 'not_found' });

      const composed = await groupComposeAdapter.composeGroupFromChartIds(chartIds, { groupId: req.params.id });
      const artifactPayload = {
        kind: 'group',
        owner_user_id: ownerUserId,
        group_id: req.params.id,
        chart_ids: chartIds,
        vector_hashes: composed.provenance.vector_hashes,
        seed: composed.provenance.seed,
        algorithm_version: composed.provenance.algorithm_version,
        plan_hash: composed.planHash,
        composition_id: composed.compositionId,
      };
      const artifactHash = artifactHashFromPayload(artifactPayload);
      let artifact = await pgStore.getCompositeArtifactByHash(ownerUserId, 'group', artifactHash);
      if (!artifact) {
        artifact = await pgStore.createCompositeArtifact({
          ownerUserId,
          kind: 'group',
          groupId: req.params.id,
          chartIds,
          vectorHashes: composed.provenance.vector_hashes,
          seed: composed.provenance.seed,
          algorithmVersion: composed.provenance.algorithm_version,
          planHash: composed.planHash,
          compositionId: composed.compositionId,
          artifactHash,
        });
      }
      return res.status(200).json({
        groupId: req.params.id,
        artifact,
      });
    } catch (e) {
      if (String(e?.message || '').includes('missing vectors')) {
        return res.status(422).json({ error: 'missing_vectors' });
      }
      return res.status(500).json({ error: e?.message || 'Failed to build group composite' });
    }
  }

  router.get('/groups/:id/composite', buildGroupComposite);
  router.post('/groups/:id/composite', buildGroupComposite);

  return router;
}

module.exports = { createStage4Router };
