/**
 * Campaign daily transit engine — solo / group / auto.
 */

const express = require('express');
const path = require('path');

const pgStore = require('../../lib/pg-store');
const { validateCanonicalLocation, transitContextFingerprint, canonicalJson, sha256 } = require('../lib/canonical-location');
const { anchorFallbackOrder } = require('../lib/campaign-daily-anchor');

const vnextRoot = path.join(__dirname, '../../dist/vnext/vnext');

function loadVnext() {
  const phase1 = require(path.join(vnextRoot, 'campaign/phase1'));
  return {
    fetchChartSnapshot: require(path.join(vnextRoot, 'core/architecture-engine')).fetchChartSnapshot,
    resolveRelationalConnectionFromChartIds: require(path.join(vnextRoot, 'relational/resolve-relational-connection-context'))
      .resolveRelationalConnectionFromChartIds,
    resolveCampaignDaily: phase1.resolveCampaignDaily,
    campaignPhase1DerivationFingerprint: phase1.campaignPhase1DerivationFingerprint,
    buildTransitChartInput: require(path.join(vnextRoot, 'campaign/transit-chart-input')).buildTransitChartInput,
    getChartById: require(path.join(vnextRoot, 'compat/chart-store')).getChartById,
  };
}

function requireCaller(req, res) {
  const userId = (req.headers['x-caller-user-id'] || req.query.userId || '').toString().trim();
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return userId;
}

function sortedIds(arr) {
  return [...(arr || [])].filter((x) => typeof x === 'string').sort((a, b) => a.localeCompare(b, 'en'));
}

function sortedEq(a, b) {
  const sa = sortedIds(a);
  const sb = sortedIds(b);
  if (sa.length !== sb.length) return false;
  return sa.every((v, i) => v === sb[i]);
}

function chartRowToNatalInput(chart) {
  if (!chart || !chart.timezone || !String(chart.timezone).trim()) {
    const err = new Error('NATAL_TIMEZONE_REQUIRED');
    err.code = 'NATAL_TIMEZONE_REQUIRED';
    throw err;
  }
  const t = chart.time;
  const timeNorm = typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : String(t || '12:00').slice(0, 5);
  return {
    date: chart.date,
    time: timeNorm,
    lat: chart.lat,
    lon: chart.lon,
    timezone: chart.timezone,
  };
}

function createCampaignDailyRouter() {
  const router = express.Router({ mergeParams: true });

  if (!process.env.POSTGRES_URL) {
    router.use((_req, res) => res.status(501).json({ error: 'campaign_daily_requires_postgres' }));
    return router;
  }

  let vn;
  try {
    vn = loadVnext();
  } catch (e) {
    console.error('[campaign-daily] vnext dist missing; run npm run vnext:build', e);
    router.use((_req, res) => res.status(503).json({ error: 'campaign_daily_engine_unavailable', message: 'Run vnext:build' }));
    return router;
  }

  async function handleDaily(req, res) {
    const callerUserId = requireCaller(req, res);
    if (!callerUserId) return;

    const campaignId = (req.params.id || '').toString().trim();
    if (!campaignId) return res.status(400).json({ error: 'invalid_request', message: 'campaign id required' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const date = (req.query.date || body.date || '').toString().trim();
    const time = (req.query.time || body.time || '').toString().trim();
    const engineVersion = (req.query.engineVersion || body.engineVersion || 'campaign_daily_phase1_v1').toString().trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'invalid_request', message: 'date YYYY-MM-DD required' });
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ error: 'invalid_request', message: 'time HH:mm required' });
    }

    const campaign = await pgStore.getStage5CampaignById(campaignId);
    if (!campaign) return res.status(404).json({ error: 'not_found' });
    if (campaign.ownerUserId !== callerUserId && !campaign.participantUserIds.includes(callerUserId)) {
      return res.status(404).json({ error: 'not_found' });
    }

    const mode = campaign.mode;
    if (!['solo', 'group', 'auto'].includes(mode)) {
      return res.status(422).json({ error: 'unprocessable', message: 'invalid campaign mode' });
    }

    const existing = await pgStore.getCampaignDailyState(campaignId, date, engineVersion);
    if (existing) {
      if (mode === 'solo') {
        const locVal = validateCanonicalLocation(body.location);
        if (!locVal.ok) {
          return res.status(400).json({ error: locVal.error, code: locVal.code || 'LOCATION_INVALID' });
        }
        const fpReq = transitContextFingerprint(locVal.location, date, time);
        if (fpReq !== existing.transitContextFingerprint) {
          return res.status(409).json({ error: 'TRANSIT_CONTEXT_MISMATCH', code: 'TRANSIT_CONTEXT_MISMATCH' });
        }
      }
      return res.status(200).json({
        campaignId,
        calendarDate: date,
        engineVersion,
        mode: existing.mode,
        fromCache: true,
        anchorUserId: existing.anchorUserId,
        transitContextFingerprint: existing.transitContextFingerprint,
        daily: existing.dailyStateJson,
      });
    }

    try {
      if (mode === 'solo') {
        const locVal = validateCanonicalLocation(body.location);
        if (!locVal.ok) {
          return res.status(400).json({ error: locVal.error, code: locVal.code || 'LOCATION_INVALID' });
        }
        const location = locVal.location;
        const fpReq = transitContextFingerprint(location, date, time);

        const charts = campaign.participantChartIds || [];
        if (charts.length !== 1) {
          return res.status(422).json({ error: 'unprocessable', message: 'solo campaign must have exactly one chart' });
        }

        const chart = await vn.getChartById(charts[0]);
        if (!chart) return res.status(422).json({ error: 'unprocessable', message: 'natal chart not found' });

        let natalInput;
        try {
          natalInput = chartRowToNatalInput(chart);
        } catch (e) {
          if (e.code === 'NATAL_TIMEZONE_REQUIRED') {
            return res.status(422).json({ error: 'unprocessable', code: 'NATAL_TIMEZONE_REQUIRED' });
          }
          throw e;
        }

        const transitInput = vn.buildTransitChartInput({ date, time, location });

        const [natal, transit] = await Promise.all([
          vn.fetchChartSnapshot(natalInput),
          vn.fetchChartSnapshot(transitInput),
        ]);

        const stateHashBefore = campaign.stateHash || '';

        const seed = vn.resolveCampaignDaily({
          kind: 'solo',
          campaign_id: campaignId,
          chart_id: charts[0],
          date,
          state_hash_before: stateHashBefore,
          natal,
          transit,
        });

        if (seed.refusal && seed.refusal.code === 'NO_PRIMARY_PRESSURE') {
          return res.status(422).json({
            error: 'NO_PRIMARY_PRESSURE',
            code: 'NO_PRIMARY_PRESSURE',
            campaignResolutionSeed: seed,
          });
        }

        const derivationInputsFingerprint = vn.campaignPhase1DerivationFingerprint(seed);

        const daily = {
          engine_version: engineVersion,
          trait_derivation_mode: seed.trait_derivation_mode,
          campaign_resolution_seed: seed,
          mode: 'solo',
        };
        const dailyStateJson = {
          daily,
          meta: {
            campaign_id: campaignId,
            calendar_date: date,
            anchor_user_id: callerUserId,
            transit_context_fingerprint: fpReq,
            derivation_inputs_fingerprint: derivationInputsFingerprint,
            phase1_engine: seed.provenance.engine_version,
            phase1_rules: seed.provenance.rules_version,
          },
        };
        const dailyStateHash = sha256(canonicalJson(daily));

        const { inserted, row } = await pgStore.insertCampaignDailyStateIfMissing({
          campaignId,
          calendarDate: date,
          engineVersion,
          mode: 'solo',
          anchorUserId: callerUserId,
          transitContextJson: location,
          transitContextFingerprint: fpReq,
          dailyStateJson: dailyStateJson,
          dailyStateHash,
          derivationInputsFingerprint,
        });

        if (!row) return res.status(500).json({ error: 'persist_failed' });
        if (!inserted && row.transitContextFingerprint !== fpReq) {
          return res.status(409).json({ error: 'TRANSIT_CONTEXT_MISMATCH', code: 'TRANSIT_CONTEXT_MISMATCH' });
        }

        return res.status(200).json({
          campaignId,
          calendarDate: date,
          engineVersion,
          mode: 'solo',
          fromCache: !inserted,
          anchorUserId: row.anchorUserId,
          transitContextFingerprint: row.transitContextFingerprint,
          daily: row.dailyStateJson,
        });
      }

      /* group + auto */
      const participantCharts = sortedIds(campaign.participantChartIds);
      if (participantCharts.length < 2) {
        return res.status(422).json({ error: 'unprocessable', message: 'group campaign requires at least two charts' });
      }

      const artifactId = campaign.compositeArtifactId;
      if (!artifactId) {
        return res.status(422).json({ error: 'unprocessable', message: 'composite_artifact_id required' });
      }
      const artifact = await pgStore.getCompositeArtifactById(artifactId);
      if (!artifact || artifact.kind !== 'group') {
        return res.status(422).json({ error: 'unprocessable', message: 'invalid group composite artifact' });
      }
      if (campaign.groupId && artifact.groupId && artifact.groupId !== campaign.groupId) {
        return res.status(422).json({ error: 'unprocessable', message: 'artifact group mismatch' });
      }
      if (!sortedEq(artifact.chartIds, participantCharts)) {
        return res.status(422).json({ error: 'unprocessable', message: 'artifact chart set mismatch' });
      }

      let ctx;
      try {
        ctx = await vn.resolveRelationalConnectionFromChartIds(participantCharts, campaign.groupId || undefined);
      } catch (e) {
        const msg = String(e?.message || '');
        if (msg.includes('missing') && msg.toLowerCase().includes('vector')) {
          return res.status(422).json({ error: 'unprocessable', code: 'missing_vectors' });
        }
        throw e;
      }

      const transitOrder = anchorFallbackOrder(campaignId, date, engineVersion, campaign.participantUserIds);

      let anchorUserId = null;
      let anchorLocation = null;
      for (const uid of transitOrder) {
        const uctx = await pgStore.getUserTransitContext(uid);
        if (!uctx || !uctx.contextJson) continue;
        const locVal = validateCanonicalLocation(uctx.contextJson);
        if (!locVal.ok) continue;
        anchorUserId = uid;
        anchorLocation = locVal.location;
        break;
      }

      if (!anchorLocation || !anchorUserId) {
        return res.status(422).json({
          error: 'unprocessable',
          code: 'NO_VALID_GROUP_TRANSIT_CONTEXT',
          message: 'No participant has valid stored transit context',
        });
      }

      const transitInput = vn.buildTransitChartInput({ date, time, location: anchorLocation });
      const transit = await vn.fetchChartSnapshot(transitInput);

      const memberNatals = [];
      for (const cid of participantCharts) {
        const ch = await vn.getChartById(cid);
        if (!ch) {
          return res.status(422).json({ error: 'unprocessable', message: `natal chart not found: ${cid}` });
        }
        let natalInputG;
        try {
          natalInputG = chartRowToNatalInput(ch);
        } catch (e) {
          if (e.code === 'NATAL_TIMEZONE_REQUIRED') {
            return res.status(422).json({ error: 'unprocessable', code: 'NATAL_TIMEZONE_REQUIRED' });
          }
          throw e;
        }
        memberNatals.push(await vn.fetchChartSnapshot(natalInputG));
      }

      const stateHashBeforeG = campaign.stateHash || '';

      const seed = vn.resolveCampaignDaily({
        kind: 'group',
        campaign_id: campaignId,
        group_id: campaign.groupId || undefined,
        date,
        state_hash_before: stateHashBeforeG,
        chart_ids_ordered: participantCharts,
        member_natals: memberNatals,
        transit,
        vector_hashes: ctx.provenance.vector_hashes || {},
      });

      if (seed.refusal && seed.refusal.code === 'NO_PRIMARY_PRESSURE') {
        return res.status(422).json({
          error: 'NO_PRIMARY_PRESSURE',
          code: 'NO_PRIMARY_PRESSURE',
          campaignResolutionSeed: seed,
        });
      }

      const derivationInputsFingerprint = vn.campaignPhase1DerivationFingerprint(seed);

      const daily = {
        engine_version: engineVersion,
        trait_derivation_mode: seed.trait_derivation_mode,
        campaign_resolution_seed: seed,
        mode: mode === 'auto' ? 'auto' : 'group',
      };
      const fpAnchor = transitContextFingerprint(anchorLocation, date, time);
      const dailyStateJson = {
        daily,
        meta: {
          campaign_id: campaignId,
          calendar_date: date,
          anchor_user_id: anchorUserId,
          transit_context_fingerprint: fpAnchor,
          derivation_inputs_fingerprint: derivationInputsFingerprint,
          phase1_engine: seed.provenance.engine_version,
          phase1_rules: seed.provenance.rules_version,
        },
      };
      const dailyStateHash = sha256(canonicalJson(daily));

      const { inserted, row } = await pgStore.insertCampaignDailyStateIfMissing({
        campaignId,
        calendarDate: date,
        engineVersion,
        mode,
        anchorUserId,
        transitContextJson: anchorLocation,
        transitContextFingerprint: fpAnchor,
        dailyStateJson,
        dailyStateHash,
        derivationInputsFingerprint,
      });

      if (!row) return res.status(500).json({ error: 'persist_failed' });

      return res.status(200).json({
        campaignId,
        calendarDate: date,
        engineVersion,
        mode: row.mode,
        fromCache: !inserted,
        anchorUserId: row.anchorUserId,
        transitContextFingerprint: row.transitContextFingerprint,
        daily: row.dailyStateJson,
      });
    } catch (e) {
      const msg = String(e?.message || '');
      console.error('[campaign-daily]', e);
      if (msg.includes('Invalid date') || msg.includes('Invalid time') || msg.includes('timezone required')) {
        return res.status(400).json({ error: 'invalid_request', message: msg });
      }
      return res.status(500).json({ error: e?.message || 'campaign_daily_failed' });
    }
  }

  router.get('/campaigns/:id/daily', handleDaily);
  router.post('/campaigns/:id/daily', express.json({ limit: '64kb' }), handleDaily);
  return router;
}

module.exports = { createCampaignDailyRouter };
