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
    materializeCampaignDaily: require(path.join(vnextRoot, 'campaign/materialize-daily')).materializeCampaignDaily,
    applyOutcome: require(path.join(vnextRoot, 'rpg/campaign/state-machine')).applyOutcome,
    buildChallengeOutcome: require(path.join(vnextRoot, 'rpg/reflection-mapper')).buildChallengeOutcome,
    hashCanonicalJson: require(path.join(vnextRoot, 'rpg/hash/json-hash')).hashCanonicalJson,
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

function currentCampaignState(campaign) {
  const state = campaign && campaign.stateJson && typeof campaign.stateJson === 'object' ? campaign.stateJson : {};
  return {
    tone_track: state.tone_track && typeof state.tone_track === 'object' ? state.tone_track : { neutral: 1 },
    domain_track: state.domain_track && typeof state.domain_track === 'object' ? state.domain_track : {},
    chapter: Number.isFinite(state.chapter) ? state.chapter : 1,
    flags: Array.isArray(state.flags) ? state.flags : [],
    history: Array.isArray(state.history) ? state.history : [],
  };
}

async function buildDailyStateJson(params) {
  const {
    vn,
    campaign,
    calendarDate,
    engineVersion,
    mode,
    anchorUserId,
    transitContextFingerprintValue,
    resolution,
    natalSnapshot,
    transitSnapshot,
  } = params;

  const materialized = await vn.materializeCampaignDaily({
    resolution,
    state: currentCampaignState(campaign),
    natalSnapshot,
    transitSnapshot,
  });

  const daily = {
    engine_version: engineVersion,
    trait_derivation_mode: resolution.trait_derivation_mode,
    campaign_resolution: resolution,
    character_sheet: materialized.character_sheet,
    challenge_archetype: materialized.challenge_archetype,
    challenge: materialized.challenge,
    response_paths: materialized.response_paths,
    choice_outcome_patch_ids: materialized.choice_outcome_patch_ids,
    challenge_fingerprint: materialized.challenge_fingerprint,
    state_hash_before: resolution.state_hash_before,
    mode,
  };

  return {
    daily,
    resolution: null,
    meta: {
      campaign_id: campaign.campaignId,
      calendar_date: calendarDate,
      anchor_user_id: anchorUserId,
      transit_context_fingerprint: transitContextFingerprintValue,
      derivation_inputs_fingerprint: vn.campaignPhase1DerivationFingerprint(resolution),
      phase1_engine: resolution.provenance.engine_version,
      phase1_rules: resolution.provenance.rules_version,
    },
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
      if (
        existing.dailyStateJson &&
        existing.dailyStateJson.daily &&
        existing.dailyStateJson.daily.campaign_resolution &&
        existing.dailyStateJson.daily.challenge &&
        existing.dailyStateJson.daily.challenge_fingerprint
      ) {
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

        const dailyStateJson = await buildDailyStateJson({
          vn,
          campaign,
          calendarDate: date,
          engineVersion,
          mode: 'solo',
          anchorUserId: callerUserId,
          transitContextFingerprintValue: fpReq,
          resolution: seed,
          natalSnapshot: natal,
          transitSnapshot: transit,
        });
        const dailyStateHash = sha256(canonicalJson(dailyStateJson));

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
          derivationInputsFingerprint: dailyStateJson.meta.derivation_inputs_fingerprint,
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

      const fpAnchor = transitContextFingerprint(anchorLocation, date, time);
      const primaryChartId =
        seed.daily_pressure_state &&
        seed.daily_pressure_state.group_context &&
        Array.isArray(seed.daily_pressure_state.group_context.primary_member_chart_ids) &&
        seed.daily_pressure_state.group_context.primary_member_chart_ids.length > 0
          ? seed.daily_pressure_state.group_context.primary_member_chart_ids[0]
          : participantCharts[0];
      const primaryIndex = Math.max(0, participantCharts.indexOf(primaryChartId));
      const challengeNatal = memberNatals[primaryIndex];
      const dailyStateJson = await buildDailyStateJson({
        vn,
        campaign,
        calendarDate: date,
        engineVersion,
        mode: mode === 'auto' ? 'auto' : 'group',
        anchorUserId,
        transitContextFingerprintValue: fpAnchor,
        resolution: seed,
        natalSnapshot: challengeNatal,
        transitSnapshot: transit,
      });
      const dailyStateHash = sha256(canonicalJson(dailyStateJson));

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
        derivationInputsFingerprint: dailyStateJson.meta.derivation_inputs_fingerprint,
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

  async function handleResolve(req, res) {
    const callerUserId = requireCaller(req, res);
    if (!callerUserId) return;

    const campaignId = (req.params.id || '').toString().trim();
    if (!campaignId) return res.status(400).json({ error: 'invalid_request', message: 'campaign id required' });

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const calendarDate = (body.calendarDate || '').toString().trim();
    const engineVersion = (body.engineVersion || 'campaign_daily_phase1_v1').toString().trim();
    const choiceId = (body.choiceId || '').toString().trim();
    const challengeFingerprint = (body.challengeFingerprint || '').toString().trim();
    const stateHashBefore = (body.stateHashBefore || '').toString().trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
      return res.status(400).json({ error: 'invalid_request', message: 'calendarDate YYYY-MM-DD required' });
    }
    if (!choiceId) {
      return res.status(400).json({ error: 'invalid_request', message: 'choiceId required' });
    }
    if (!challengeFingerprint) {
      return res.status(400).json({ error: 'invalid_request', message: 'challengeFingerprint required' });
    }
    if (!stateHashBefore) {
      return res.status(400).json({ error: 'invalid_request', message: 'stateHashBefore required' });
    }

    try {
      const result = await pgStore.withTransaction(async (client) => {
        const campaignRes = await client.query(
          `SELECT campaign_id, owner_user_id, participant_user_ids, state_json, state_hash, state_version
           FROM stage5_campaigns
           WHERE campaign_id = $1
           FOR UPDATE`,
          [campaignId]
        );
        const campaign = campaignRes.rows[0];
        if (!campaign) {
          return { status: 404, body: { error: 'not_found' } };
        }
        const participantUserIds = Array.isArray(campaign.participant_user_ids) ? campaign.participant_user_ids : [];
        if (campaign.owner_user_id !== callerUserId && !participantUserIds.includes(callerUserId)) {
          return { status: 404, body: { error: 'not_found' } };
        }

        const dailyRes = await client.query(
          `SELECT campaign_id, calendar_date, engine_version, daily_state_json, daily_state_hash
           FROM campaign_daily_state
           WHERE campaign_id = $1 AND calendar_date = $2::date AND engine_version = $3
           FOR UPDATE`,
          [campaignId, calendarDate, engineVersion]
        );
        const row = dailyRes.rows[0];
        if (!row) {
          return { status: 404, body: { error: 'not_found', message: 'daily generation not found' } };
        }

        const dailyStateJson = row.daily_state_json || {};
        const daily = dailyStateJson.daily || {};
        if (!daily.challenge || !daily.challenge_fingerprint || !daily.choice_outcome_patch_ids) {
          return { status: 422, body: { error: 'challenge_unavailable', code: 'CHALLENGE_UNAVAILABLE' } };
        }
        if (daily.challenge_fingerprint !== challengeFingerprint) {
          return { status: 409, body: { error: 'CHALLENGE_MISMATCH', code: 'CHALLENGE_MISMATCH' } };
        }
        if ((daily.state_hash_before || '') !== stateHashBefore) {
          return { status: 409, body: { error: 'STATE_HASH_MISMATCH', code: 'STATE_HASH_MISMATCH' } };
        }
        if ((campaign.state_hash || '') !== stateHashBefore) {
          return { status: 409, body: { error: 'STALE_CAMPAIGN_STATE', code: 'STALE_CAMPAIGN_STATE' } };
        }

        const choices = Array.isArray(daily.challenge.choices) ? daily.challenge.choices : [];
        const choice = choices.find((entry) => entry && entry.id === choiceId);
        if (!choice) {
          return { status: 400, body: { error: 'invalid_request', message: 'choiceId not found in challenge choices' } };
        }

        if (dailyStateJson.resolution) {
          if (dailyStateJson.resolution.choice_id === choiceId) {
            return {
              status: 200,
              body: {
                campaignId,
                calendarDate,
                engineVersion,
                resolution: dailyStateJson.resolution,
                newState: campaign.state_json,
                stateHash: campaign.state_hash,
                stateVersion: campaign.state_version,
              },
            };
          }
          return { status: 409, body: { error: 'ALREADY_RESOLVED', code: 'ALREADY_RESOLVED' } };
        }

        const outcomePatchId = daily.choice_outcome_patch_ids[choiceId];
        if (!outcomePatchId) {
          return { status: 422, body: { error: 'invalid_choice_mapping', code: 'INVALID_CHOICE_MAPPING' } };
        }

        const previousState = {
          tone_track: campaign.state_json && campaign.state_json.tone_track && typeof campaign.state_json.tone_track === 'object'
            ? campaign.state_json.tone_track
            : { neutral: 1 },
          domain_track: campaign.state_json && campaign.state_json.domain_track && typeof campaign.state_json.domain_track === 'object'
            ? campaign.state_json.domain_track
            : {},
          chapter: campaign.state_json && Number.isFinite(campaign.state_json.chapter) ? campaign.state_json.chapter : 1,
          flags: campaign.state_json && Array.isArray(campaign.state_json.flags) ? campaign.state_json.flags : [],
          history: campaign.state_json && Array.isArray(campaign.state_json.history) ? campaign.state_json.history : [],
        };
        const nextState = vn.applyOutcome(previousState, {
          turn_id: `${campaignId}:${calendarDate}`,
          choice_id: choiceId,
          outcome_patch_id: outcomePatchId,
          tone_tag: daily.challenge.primaryPressure && daily.challenge.primaryPressure.type ? String(daily.challenge.primaryPressure.type) : undefined,
        });
        const newStateHash = vn.hashCanonicalJson(nextState);
        const outcome = vn.buildChallengeOutcome({
          scene: daily.challenge,
          choice,
          natalSnapshot: {
            ts: '',
            tz: 'UTC',
            lat: 0,
            lon: 0,
          },
          transitSnapshot: {
            ts: '',
            tz: 'UTC',
            lat: 0,
            lon: 0,
          },
        });

        const resolution = {
          choice_id: choiceId,
          outcome_patch_id: outcomePatchId,
          response_path_id: choiceId,
          response_pattern_tag: choice.patternTag,
          challenge_fingerprint: daily.challenge_fingerprint,
          state_hash_before: stateHashBefore,
          state_hash_after: newStateHash,
          outcome,
          resolved_at: new Date().toISOString(),
        };

        const nextDailyStateJson = {
          ...dailyStateJson,
          resolution,
        };
        const nextDailyStateHash = sha256(canonicalJson(nextDailyStateJson));

        await client.query(
          `UPDATE stage5_campaigns
           SET state_json = $1::jsonb, state_hash = $2, state_version = state_version + 1, updated_at = NOW()
           WHERE campaign_id = $3`,
          [JSON.stringify(nextState), newStateHash, campaignId]
        );

        await client.query(
          `UPDATE campaign_daily_state
           SET daily_state_json = $1::jsonb, daily_state_hash = $2
           WHERE campaign_id = $3 AND calendar_date = $4::date AND engine_version = $5`,
          [JSON.stringify(nextDailyStateJson), nextDailyStateHash, campaignId, calendarDate, engineVersion]
        );

        return {
          status: 200,
          body: {
            campaignId,
            calendarDate,
            engineVersion,
            resolution,
            newState: nextState,
            stateHash: newStateHash,
            stateVersion: campaign.state_version + 1,
          },
        };
      });

      return res.status(result.status).json(result.body);
    } catch (e) {
      console.error('[campaign-daily-resolve]', e);
      return res.status(500).json({ error: e?.message || 'campaign_daily_resolve_failed' });
    }
  }

  router.get('/campaigns/:id/daily', handleDaily);
  router.post('/campaigns/:id/daily', express.json({ limit: '64kb' }), handleDaily);
  router.post('/campaigns/:id/daily/resolve', express.json({ limit: '64kb' }), handleResolve);
  return router;
}

module.exports = { createCampaignDailyRouter };
