const crypto = require('crypto');
const express = require('express');

const pgStore = require('../../lib/pg-store');
const relationshipArtifacts = require('../../lib/relationship-artifacts');
const {
  COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
  readRelationalExpressionVersionFromDailyArtifact,
  buildRelationalFreshness,
} = require('../../lib/community-artifact-freshness');
const groupComposeAdapter = require('../../dist/vnext/vnext/relational/composition/group-compose-adapter');
const { transitParamsToChartInput } = require('../../dist/vnext/vnext/relational/weather/transit-chart-input');
const { fetchChartSnapshot } = require('../../dist/vnext/vnext/core/architecture-engine');
const { resolveRelationalConnectionFromChartIds } = require('../../dist/vnext/vnext/relational/resolve-relational-connection-context');
const { computeRelationalWeatherV1 } = require('../../dist/vnext/vnext/relational/weather/compute-relational-weather-v1');
const { snapshotFingerprint } = require('../../dist/vnext/vnext/canonical/stable-json');

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

  /** Pair forecast auth is participant-scoped (not owner_user_id-scoped). */
  async function assertPairChartsAuthorizedForForecast(viewerUserId, relationshipId, chartIds) {
    if (!viewerUserId || !relationshipId || !chartIds || chartIds.length !== 2) return false;
    return pgStore.userParticipatesInRelationship(relationshipId, viewerUserId);
  }

  /** Group forecast auth is member-scoped (owner or platform member). */
  async function assertGroupChartsAuthorizedForForecast(viewerUserId, groupId, chartIds) {
    const members = await pgStore.listRelationalGroupMembersForScope(groupId, viewerUserId);
    if (!members || members.length === 0) return false;
    const expected = Array.from(new Set(members.map((m) => m.chartId))).sort((a, b) => a.localeCompare(b, 'en'));
    const got = Array.from(new Set(chartIds || [])).sort((a, b) => a.localeCompare(b, 'en'));
    if (expected.length !== got.length || expected.some((id, i) => id !== got[i])) return false;
    for (const m of members) {
      // eslint-disable-next-line no-await-in-loop
      const ch = await pgStore.getChart(m.chartId);
      if (!ch || ch.ownerId !== m.userId) return false;
    }
    return true;
  }

  function parseRelationalWeatherText(value) {
    if (typeof value === 'string') return value.trim();
    if (!value || typeof value !== 'object') return '';
    const v = value;
    const short = typeof v.short === 'string' ? v.short.trim() : '';
    const long = typeof v.long === 'string' ? v.long.trim() : '';
    const bullets = Array.isArray(v.bullets) ? v.bullets.map((b) => String(b || '').trim()).filter(Boolean) : [];
    const out = [short, long, bullets.length ? bullets.map((b) => `- ${b}`).join('\n') : ''].filter(Boolean).join('\n\n');
    return out.trim();
  }

  function toArtifactStatus(composedText, exportId) {
    const readableText = parseRelationalWeatherText(composedText);
    if (!readableText) return 'failed';
    if (exportId == null || String(exportId).trim() === '') return 'available';
    return /^[a-f0-9]{64}$/.test(String(exportId).trim()) ? 'available' : 'partial';
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

  function buildCommunityFeedItemV1(weather, kind, bindingId, chartIdsOrdered) {
    return {
      weatherVersion: 'relational_weather_v1',
      kind,
      bindingId,
      chartIdsOrdered,
      transit: weather.transit,
      weather: {
        stateHash: weather.stateHash,
        activation: weather.activation,
        score: weather.score,
        themes: weather.themes.dominantThemes,
      },
    };
  }

  async function runRelationalForecast(req, res, { kind, bindingId, chartIds, relationshipId = null }) {
    const viewerUserId = requireOwner(req, res);
    if (!viewerUserId) return;
    try {
      const transitDatetime = (req.query.transitDatetime || '').toString().trim();
      if (!transitDatetime) {
        return res.status(400).json({ error: 'validation_error', code: 'TRANSIT_DATETIME_REQUIRED' });
      }
      const transitLat = Number.parseFloat(String(req.query.transitLatitude));
      const transitLon = Number.parseFloat(String(req.query.transitLongitude));
      const transitTimezone = (req.query.transitTimezone || 'UTC').toString().trim();
      const chartInput = transitParamsToChartInput({
        transitDatetime,
        transitLatitude: transitLat,
        transitLongitude: transitLon,
        transitTimezone,
      });
      const normalizedChartIdsOrdered = pgStore.normalizeChartIdsOrdered(chartIds);
      let authorized = false;
      if (kind === 'pair' && normalizedChartIdsOrdered.length === 2) {
        authorized = await assertPairChartsAuthorizedForForecast(viewerUserId, relationshipId || bindingId, normalizedChartIdsOrdered);
      } else if (kind === 'group') {
        authorized = await assertGroupChartsAuthorizedForForecast(viewerUserId, bindingId, normalizedChartIdsOrdered);
      } else {
        authorized = await assertOwnedCharts(viewerUserId, normalizedChartIdsOrdered);
      }
      if (!authorized) return res.status(404).json({ error: 'not_found' });

      const transitSnapshot = await fetchChartSnapshot(chartInput);
      const canonicalDayBucket = pgStore.canonicalDayBucketFromTransitTs(transitSnapshot.ts);
      const chartIdsOrderedHash = pgStore.hashChartIdsOrdered(normalizedChartIdsOrdered);
      const ctx = await resolveRelationalConnectionFromChartIds(normalizedChartIdsOrdered, bindingId);
      const weather = computeRelationalWeatherV1({
        connection: { kind, bindingId, chartIdsOrdered: ctx.chartIdsOrdered },
        transit: transitSnapshot,
        memberSnapshotsOrdered: ctx.natalSnapshotsOrdered,
        vectorHashes: ctx.provenance.vector_hashes,
      });
      const feedItem = buildCommunityFeedItemV1(weather, kind, bindingId, ctx.chartIdsOrdered);

      const wantCompose = String(req.query.compose || '').trim() === '1';
      let artifact = null;
      if (wantCompose) {
        const identity = {
          scopeKind: kind === 'pair' ? 'pair' : 'group',
          bindingId,
          chartIdsOrderedHash,
          canonicalDayBucket,
        };
        const existing = await pgStore.getCommunityRelationalWeatherDailyArtifactByIdentity(identity);
        const existingVersion = readRelationalExpressionVersionFromDailyArtifact(existing);
        const existingFreshness = buildRelationalFreshness(
          COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
          existingVersion
        );
        if (existing && existing.artifactStatus === 'available' && existingFreshness.isCurrent) {
          artifact = {
            planHash: existing.planHash || null,
            compositionId: existing.compositionId || null,
            text: existing.textPayload || null,
            audioBase64: null,
            audio: {
              format: 'wav',
              sha256: '',
              latency_ms: 0,
              size_bytes: 0,
              base64_present: false,
              export_available: !!existing.exportJobId,
              export_id: existing.exportJobId || null,
              export_attempted: !!existing.exportJobId,
              export_error: null,
            },
            dailyArtifactIdentity: {
              dailyArtifactId: existing.id,
              scopeKind: identity.scopeKind,
              bindingId: identity.bindingId,
              chartIdsOrdered: ctx.chartIdsOrdered,
              chartIdsOrderedHash,
              canonicalDayBucket,
              transitSnapshotHash: existing.transitSnapshotHash,
            },
            freshness: existingFreshness,
          };
          return res.status(200).json({ weather, feedItem, artifact });
        }

        /** Lyria compose metadata for response when daily row has no export_job_id (e.g. storage write failed). */
        let composeAudioForResponse = null;

        const winner = await pgStore.withTransaction(async (client) => {
          await pgStore.lockCommunityRelationalWeatherIdentity(client, identity);
          const inside = await pgStore.getCommunityRelationalWeatherDailyArtifactByIdentity(identity, client);
          if (inside && inside.artifactStatus === 'available') {
            return inside;
          }
          let composed = null;
          let composeError = null;
          try {
            composed = await groupComposeAdapter.composeGroupFromChartIds(normalizedChartIdsOrdered, {
              groupId: bindingId,
              relationalWeather: weather,
            });
            if (composed && composed.audio) {
              composeAudioForResponse = {
                export_available: !!composed.audio.export_available,
                export_id: typeof composed.audio.export_id === 'string' ? composed.audio.export_id : null,
                export_attempted: !!composed.audio.export_attempted,
                export_error:
                  composed.audio.export_error != null && composed.audio.export_error !== undefined
                    ? String(composed.audio.export_error)
                    : null,
              };
            }
          } catch (err) {
            composeError = err;
          }
          const exportId =
            composed && composed.audio && typeof composed.audio.export_id === 'string' && composed.audio.export_id.trim()
              ? composed.audio.export_id.trim()
              : null;
          const nextStatus = composeError ? 'failed' : toArtifactStatus(composed?.text, exportId);
          const textPayload = composed?.text != null ? composed.text : null;
          const persistedTransitSnapshotHash =
            inside?.transitSnapshotHash || snapshotFingerprint(transitSnapshot);
          const weatherPayloadForStorage = {
            ...weather,
            meta: {
              ...(weather && typeof weather === 'object' && weather.meta && typeof weather.meta === 'object'
                ? weather.meta
                : {}),
              expressionVersion: COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
            },
          };
          const toPersist = {
            scopeKind: identity.scopeKind,
            bindingId: identity.bindingId,
            chartIdsOrdered: ctx.chartIdsOrdered,
            canonicalDayBucket,
            transitSnapshotHash: persistedTransitSnapshotHash,
            relationalWeatherStateHash: weather.stateHash || null,
            planHash: composed?.planHash || null,
            compositionId: composed?.compositionId || null,
            exportJobId: exportId,
            artifactStatus: nextStatus,
            textPayload,
            weatherPayload: weatherPayloadForStorage,
            createdByUserId: viewerUserId,
          };
          if (inside && (inside.artifactStatus === 'partial' || inside.artifactStatus === 'failed')) {
            return pgStore.updateCommunityRelationalWeatherDailyArtifact(
              { ...toPersist, id: inside.id },
              client
            );
          }
          const inserted = await pgStore.insertCommunityRelationalWeatherDailyArtifact(toPersist, client);
          if (inserted) return inserted;
          const afterConflict = await pgStore.getCommunityRelationalWeatherDailyArtifactByIdentity(identity, client);
          if (afterConflict) return afterConflict;
          const fallback = await pgStore.insertCommunityRelationalWeatherDailyArtifact(toPersist, client);
          if (fallback) return fallback;
          if (composeError) throw composeError;
          return fallback;
        });
        const rowHasExport = winner?.exportJobId != null && String(winner.exportJobId).trim() !== '';
        const ac = composeAudioForResponse;
        const showStorageError = !rowHasExport && ac && ac.export_error;
        artifact = {
          planHash: winner?.planHash || null,
          compositionId: winner?.compositionId || null,
          text: winner?.textPayload || null,
          audioBase64: null,
          audio: {
            format: 'wav',
            sha256: '',
            latency_ms: 0,
            size_bytes: 0,
            base64_present: false,
            export_available: rowHasExport || !!(ac && ac.export_available),
            export_id: rowHasExport ? String(winner.exportJobId).trim() : ac && ac.export_id ? String(ac.export_id).trim() : null,
            export_attempted: rowHasExport ? true : !!(ac && ac.export_attempted),
            export_error: showStorageError ? ac.export_error : null,
          },
          dailyArtifactIdentity: {
            dailyArtifactId: winner?.id || null,
            scopeKind: identity.scopeKind,
            bindingId: identity.bindingId,
            chartIdsOrdered: ctx.chartIdsOrdered,
            chartIdsOrderedHash,
            canonicalDayBucket,
            transitSnapshotHash: winner?.transitSnapshotHash || snapshotFingerprint(transitSnapshot),
          },
          freshness: buildRelationalFreshness(
            COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
            readRelationalExpressionVersionFromDailyArtifact(winner)
          ),
        };
      }

      return res.status(200).json({ weather, feedItem, artifact });
    } catch (e) {
      const msg = String(e?.message || '');
      if (msg.includes('missing vectors') || e?.name === 'MissingVectorsError') {
        return res.status(422).json({ error: 'missing_vectors' });
      }
      if (msg.includes('transitDatetime') || msg.includes('transitLatitude') || msg.includes('transitLongitude')) {
        return res.status(400).json({ error: 'validation_error', message: msg });
      }
      if (e?.code === 'ML_INFERENCE_UNAVAILABLE') {
        return res.status(503).json({ error: 'ml_unavailable', code: e.code });
      }
      return res.status(500).json({ error: e?.message || 'forecast_failed' });
    }
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
      const okPair = await assertPairChartsAuthorizedForForecast(ownerUserId, relationship.id, chartIds);
      if (!okPair) return res.status(404).json({ error: 'not_found' });

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

  router.post('/relationships/:id/materialize', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const out = await relationshipArtifacts.materializeRelationshipArtifact(req.params.id, ownerUserId);
      return res.status(200).json({ ok: true, ...out });
    } catch (e) {
      if (e && e.code === 'NOT_FOUND') return res.status(404).json({ error: 'not_found' });
      if (String(e?.message || '').includes('missing vectors')) {
        return res.status(422).json({ error: 'missing_vectors' });
      }
      return res.status(500).json({ error: e?.message || 'materialize_failed' });
    }
  });

  router.get('/relationships/:id/forecast', async (req, res) => {
    const viewerUserId = requireOwner(req, res);
    if (!viewerUserId) return;
    try {
      const relationship = await pgStore.getRelationshipById(req.params.id);
      if (!relationship) {
        return res.status(404).json({ error: 'not_found' });
      }
      const chartIds = [relationship.chartIdLow, relationship.chartIdHigh];
      return runRelationalForecast(req, res, {
        kind: 'pair',
        bindingId: relationship.id,
        chartIds,
        relationshipId: relationship.id,
      });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'forecast_failed' });
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
      const groups = await pgStore.listRelationalGroupsAccessibleToUser(ownerUserId);
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
      const okGroup = await assertGroupChartsAuthorizedForForecast(ownerUserId, req.params.id, chartIds);
      if (!okGroup) return res.status(404).json({ error: 'not_found' });

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
      const readingSnapshot = composed.text ? { text: composed.text } : null;
      const exportJobIdFromCompose = composed.audio && composed.audio.export_id ? String(composed.audio.export_id) : null;
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
          readingSnapshot,
          exportJobId: exportJobIdFromCompose,
        });
      } else if (readingSnapshot || exportJobIdFromCompose) {
        await pgStore.updateCompositeArtifactReadingSnapshot({
          artifactId: artifact.id,
          ownerUserId,
          readingSnapshot,
          exportJobId: exportJobIdFromCompose,
        });
        artifact = await pgStore.getCompositeArtifactById(artifact.id);
      }
      const memberUserIds = Array.from(
        new Set(
          [
            group.ownerId,
            ...members
              .map((m) => (typeof m.userId === 'string' ? m.userId.trim() : ''))
              .filter(Boolean),
          ].filter(Boolean)
        )
      );
      await pgStore.ensureCommunityGroupLibraryEntriesForMembers({
        memberUserIds,
        groupId: req.params.id,
        groupSlug: group.slug || null,
        groupName: group.name || null,
        compositeArtifactId: artifact.id,
        chartIds,
        exportJobId: artifact.exportJobId || exportJobIdFromCompose || null,
        compositionId: artifact.compositionId || composed.compositionId || null,
        planHash: artifact.planHash || composed.planHash || null,
        readingSnapshot: artifact.readingSnapshot || readingSnapshot || null,
      });
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

  router.get('/groups/:id/forecast', async (req, res) => {
    const viewerUserId = requireOwner(req, res);
    if (!viewerUserId) return;
    try {
      const group = await pgStore.resolveRelationalGroupForScope(req.params.id, viewerUserId);
      if (!group) return res.status(404).json({ error: 'not_found' });
      const members = await pgStore.listRelationalGroupMembersForScope(group.id, viewerUserId);
      if (!members || members.length === 0) {
        return res.status(400).json({ error: 'validation_error', code: 'GROUP_EMPTY' });
      }
      const chartIds = Array.from(new Set(members.map((m) => m.chartId))).sort((a, b) => a.localeCompare(b, 'en'));
      return runRelationalForecast(req, res, {
        kind: 'group',
        bindingId: group.id,
        chartIds,
      });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'forecast_failed' });
    }
  });

  // POST /api/groups/:id/invites — owner invites a peer's chart into relational group (Option B group path)
  router.post('/groups/:id/invites', async (req, res) => {
    const ownerUserId = requireOwner(req, res);
    if (!ownerUserId) return;
    try {
      const groupId = req.params.id;
      const group = await pgStore.getRelationalGroupById(groupId);
      if (!group || group.ownerId !== ownerUserId) return res.status(404).json({ error: 'not_found' });
      const { inviteeUserId, inviteeChartId } = req.body || {};
      const iu = (inviteeUserId && String(inviteeUserId).trim()) || '';
      const ic = (inviteeChartId && String(inviteeChartId).trim()) || '';
      if (!iu || !ic) return res.status(400).json({ error: 'validation_error', message: 'inviteeUserId and inviteeChartId required' });
      if (iu === ownerUserId) return res.status(400).json({ error: 'validation_error', message: 'cannot invite self' });
      const chart = await pgStore.getChart(ic);
      if (!chart || chart.ownerId !== iu) return res.status(400).json({ error: 'validation_error', message: 'invitee must own inviteeChartId' });
      const invite = await pgStore.createRelationalGroupInvite({
        groupId,
        inviterUserId: ownerUserId,
        inviteeUserId: iu,
        inviteeChartId: ic,
      });
      return res.status(201).json(invite);
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'invite_failed' });
    }
  });

  // POST /api/groups/:id/invites/:inviteId/accept — invitee accepts; adds member row
  router.post('/groups/:id/invites/:inviteId/accept', async (req, res) => {
    const inviteeUserId = requireOwner(req, res);
    if (!inviteeUserId) return;
    try {
      const { id: groupId, inviteId } = req.params;
      const result = await pgStore.acceptRelationalGroupInvite(inviteId, inviteeUserId, groupId);
      if (!result.ok) {
        if (result.error === 'forbidden') return res.status(403).json({ error: 'forbidden' });
        if (result.error === 'group_mismatch') return res.status(400).json({ error: 'group_mismatch' });
        return res.status(404).json({ error: 'not_found' });
      }
      return res.status(200).json({ accepted: true, member: result.member });
    } catch (e) {
      return res.status(500).json({ error: e?.message || 'accept_failed' });
    }
  });

  return router;
}

module.exports = { createStage4Router };
