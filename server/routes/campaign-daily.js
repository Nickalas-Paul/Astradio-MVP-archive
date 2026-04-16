/**
 * Campaign daily transit engine — solo / group / auto.
 */

const express = require('express');

const pgStore = require('../../lib/pg-store');
const { validateCanonicalLocation, canonicalJson, sha256 } = require('../lib/canonical-location');
const { campaignDailyTransitContextFingerprint } = require('../lib/campaign-daily-transit-fingerprint');
const { anchorFallbackOrder } = require('../lib/campaign-daily-anchor');
const {
  acceptMemberResponse,
  buildInitialResponseCollection,
  buildLockedParticipantRoster,
  computeReadiness,
  normalizeResponseCollection,
  orderedAcceptedResponses,
  resolveRosterMember,
} = require('../lib/campaign-group-resolve');
const {
  CAMPAIGN_DAILY_ENGINE_VERSION,
  requireCampaignRuntimeModule,
} = require('../lib/campaign-runtime');

function loadVnext() {
  const phase1 = requireCampaignRuntimeModule('campaign/phase1');
  return {
    fetchChartSnapshot: requireCampaignRuntimeModule('core/architecture-engine').fetchChartSnapshot,
    resolveRelationalConnectionFromChartIds: requireCampaignRuntimeModule('relational/resolve-relational-connection-context')
      .resolveRelationalConnectionFromChartIds,
    resolveCampaignDaily: phase1.resolveCampaignDaily,
    campaignPhase1DerivationFingerprint: phase1.campaignPhase1DerivationFingerprint,
    buildTransitChartInput: requireCampaignRuntimeModule('campaign/transit-chart-input').buildTransitChartInput,
    materializeCampaignDaily: requireCampaignRuntimeModule('campaign/materialize-daily').materializeCampaignDaily,
    applyOutcome: requireCampaignRuntimeModule('rpg/campaign/state-machine').applyOutcome,
    buildChallengeOutcome: requireCampaignRuntimeModule('rpg/reflection-mapper').buildChallengeOutcome,
    hashCanonicalJson: requireCampaignRuntimeModule('rpg/hash/json-hash').hashCanonicalJson,
    getChartById: requireCampaignRuntimeModule('compat/chart-store').getChartById,
  };
}

function alignDailyStateJsonShape(dailyStateJson) {
  if (!dailyStateJson || typeof dailyStateJson !== 'object') return dailyStateJson;
  const daily = dailyStateJson.daily && typeof dailyStateJson.daily === 'object' ? dailyStateJson.daily : null;
  if (!daily) return dailyStateJson;

  const campaignResolution =
    daily.campaign_resolution && typeof daily.campaign_resolution === 'object'
      ? daily.campaign_resolution
      : null;

  if (daily.daily_pressure_state || !campaignResolution || !campaignResolution.daily_pressure_state) {
    return dailyStateJson;
  }

  return {
    ...dailyStateJson,
    daily: {
      ...daily,
      daily_pressure_state: campaignResolution.daily_pressure_state,
    },
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

function locationFromStoredContext(row) {
  if (!row || !row.contextJson) {
    return { ok: false, error: 'location required', code: 'LOCATION_REQUIRED' };
  }
  return validateCanonicalLocation(row.contextJson);
}

async function resolveSoloTransitContext(params) {
  const { req, body, callerUserId, existing } = params;
  const queryLocation = req.query && req.query.location ? req.query.location : null;
  const bodyLocation = body && body.location ? body.location : null;
  const inputLocation = bodyLocation || queryLocation;

  if (inputLocation) {
    return validateCanonicalLocation(inputLocation);
  }

  if (existing && existing.transitContextJson) {
    return validateCanonicalLocation(existing.transitContextJson);
  }

  const stored = await pgStore.getUserTransitContext(callerUserId);
  return locationFromStoredContext(stored);
}

function currentCampaignState(campaign) {
  const state = campaign && campaign.stateJson && typeof campaign.stateJson === 'object' ? campaign.stateJson : {};
  const rawMembers = state.members && typeof state.members === 'object' ? state.members : {};
  const members = Object.fromEntries(
    Object.entries(rawMembers)
      .filter(([memberId]) => typeof memberId === 'string' && memberId.trim())
      .map(([memberId, memberState]) => [
        memberId,
        {
          tone_track: memberState && memberState.tone_track && typeof memberState.tone_track === 'object' ? memberState.tone_track : {},
          domain_track: memberState && memberState.domain_track && typeof memberState.domain_track === 'object' ? memberState.domain_track : {},
          flags: memberState && Array.isArray(memberState.flags) ? memberState.flags : [],
          history: memberState && Array.isArray(memberState.history) ? memberState.history : [],
        },
      ]),
  );
  return {
    tone_track: state.tone_track && typeof state.tone_track === 'object' ? state.tone_track : { neutral: 1 },
    domain_track: state.domain_track && typeof state.domain_track === 'object' ? state.domain_track : {},
    chapter: Number.isFinite(state.chapter) ? state.chapter : 1,
    flags: Array.isArray(state.flags) ? state.flags : [],
    history: Array.isArray(state.history) ? state.history : [],
    members,
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
    participantRoster,
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
    daily_pressure_state: resolution.daily_pressure_state,
    character_sheet: materialized.character_sheet,
    challenge_archetype: materialized.challenge_archetype,
    challenge: materialized.challenge,
    response_paths: materialized.response_paths,
    choice_outcome_patch_ids: materialized.choice_outcome_patch_ids,
    challenge_fingerprint: materialized.challenge_fingerprint,
    state_hash_before: resolution.state_hash_before,
    participant_roster: participantRoster,
    response_collection: buildInitialResponseCollection(participantRoster),
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

function rosterFromDaily(daily) {
  return buildLockedParticipantRoster(Array.isArray(daily && daily.participant_roster) ? daily.participant_roster : []);
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
    console.error('[campaign-daily] active Campaign runtime unavailable; run npm run vnext:build', e);
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
    const engineVersion = (req.query.engineVersion || body.engineVersion || CAMPAIGN_DAILY_ENGINE_VERSION).toString().trim();

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
      let existingDailyStateJson = alignDailyStateJsonShape(existing.dailyStateJson);
      const existingDaily = existingDailyStateJson && existingDailyStateJson.daily && typeof existingDailyStateJson.daily === 'object'
        ? existingDailyStateJson.daily
        : null;
      if (existingDaily && !Array.isArray(existingDaily.participant_roster)) {
        let participantRoster = null;
        if (mode === 'solo') {
          const soloCharts = campaign.participantChartIds || [];
          if (soloCharts.length === 1) {
            participantRoster = buildLockedParticipantRoster([
              {
                user_id: campaign.ownerUserId,
                chart_id: soloCharts[0],
              },
            ]);
          }
        } else if (campaign.groupId) {
          const groupMembers = await pgStore.listRelationalGroupMembers(campaign.groupId, campaign.ownerUserId);
          const derivedRoster = buildLockedParticipantRoster(
            (Array.isArray(groupMembers) ? groupMembers : []).map((member) => ({
              user_id: member.userId,
              chart_id: member.chartId,
            })),
          );
          if (sortedEq(derivedRoster.map((entry) => entry.chart_id), campaign.participantChartIds || [])) {
            participantRoster = derivedRoster;
          }
        }

        if (participantRoster) {
          existingDailyStateJson = {
            ...existingDailyStateJson,
            daily: {
              ...existingDaily,
              participant_roster: participantRoster,
              response_collection: normalizeResponseCollection(
                participantRoster,
                existingDaily.response_collection || buildInitialResponseCollection(participantRoster),
              ),
            },
          };
          const nextExistingDailyStateHash = sha256(canonicalJson(existingDailyStateJson));
          await pgStore.withTransaction(async (client) => {
            await client.query(
              `UPDATE campaign_daily_state
               SET daily_state_json = $1::jsonb, daily_state_hash = $2
               WHERE campaign_id = $3 AND calendar_date = $4::date AND engine_version = $5`,
              [JSON.stringify(existingDailyStateJson), nextExistingDailyStateHash, campaignId, date, engineVersion]
            );
          });
        }
      }

      const isCompleteCachedDaily =
        existingDailyStateJson &&
        existingDailyStateJson.daily &&
        typeof existingDailyStateJson.daily === 'object' &&
        existingDailyStateJson.daily.campaign_resolution &&
        existingDailyStateJson.daily.challenge &&
        existingDailyStateJson.daily.challenge_fingerprint;

      /* Option A: one canonical daily per (campaign_id, calendar_date, engine_version) — first success owns the day. */
      if (isCompleteCachedDaily) {
        return res.status(200).json({
          campaignId,
          calendarDate: date,
          engineVersion,
          mode: existing.mode,
          fromCache: true,
          anchorUserId: existing.anchorUserId,
          transitContextFingerprint: existing.transitContextFingerprint,
          daily: existingDailyStateJson,
        });
      }

      if (mode === 'solo') {
        const locVal = await resolveSoloTransitContext({
          req,
          body,
          callerUserId,
          existing,
        });
        if (!locVal.ok) {
          return res.status(400).json({ error: locVal.error, code: locVal.code || 'LOCATION_INVALID' });
        }
        const fpReq = campaignDailyTransitContextFingerprint(locVal.location, date);
        if (fpReq !== existing.transitContextFingerprint) {
          return res.status(409).json({ error: 'TRANSIT_CONTEXT_MISMATCH', code: 'TRANSIT_CONTEXT_MISMATCH' });
        }
      }
    }

    try {
      if (mode === 'solo') {
        const locVal = await resolveSoloTransitContext({
          req,
          body,
          callerUserId,
          existing,
        });
        if (!locVal.ok) {
          return res.status(400).json({ error: locVal.error, code: locVal.code || 'LOCATION_INVALID' });
        }
        const location = locVal.location;
        const fpReq = campaignDailyTransitContextFingerprint(location, date);

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
        const participantRoster = buildLockedParticipantRoster([
          {
            user_id: campaign.ownerUserId,
            chart_id: charts[0],
          },
        ]);

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
          participantRoster,
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
          daily: alignDailyStateJsonShape(row.dailyStateJson),
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
      const groupMembers = await pgStore.listRelationalGroupMembers(campaign.groupId, campaign.ownerUserId);
      const participantRoster = buildLockedParticipantRoster(
        (Array.isArray(groupMembers) ? groupMembers : []).map((member) => ({
          user_id: member.userId,
          chart_id: member.chartId,
        })),
      );
      if (!sortedEq(participantRoster.map((entry) => entry.chart_id), participantCharts)) {
        return res.status(409).json({ error: 'GROUP_MEMBERSHIP_DRIFT', code: 'GROUP_MEMBERSHIP_DRIFT' });
      }

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

      const fpAnchor = campaignDailyTransitContextFingerprint(anchorLocation, date);
      // Group daily pressure is pooled across members in the resolution seed; CharacterSheet / challenge
      // materialization intentionally uses one natal (primary pressure member, else first chart)—not a blend.
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
        participantRoster,
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
        daily: alignDailyStateJsonShape(row.dailyStateJson),
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
    const engineVersion = (body.engineVersion || CAMPAIGN_DAILY_ENGINE_VERSION).toString().trim();
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

        const dailyStateJson = alignDailyStateJsonShape(row.daily_state_json || {});
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

        let participantRoster;
        try {
          participantRoster = rosterFromDaily(daily);
        } catch (e) {
          return { status: 422, body: { error: 'INVALID_PARTICIPANT_ROSTER', code: 'INVALID_PARTICIPANT_ROSTER' } };
        }
        const memberResolution = resolveRosterMember(participantRoster, callerUserId);
        if (!memberResolution.ok) {
          return { status: 409, body: { error: memberResolution.error, code: memberResolution.code } };
        }

        const choices = Array.isArray(daily.challenge.choices) ? daily.challenge.choices : [];
        const choice = choices.find((entry) => entry && entry.id === choiceId);
        if (!choice) {
          return { status: 400, body: { error: 'invalid_request', message: 'choiceId not found in challenge choices' } };
        }

        const outcomePatchId = daily.choice_outcome_patch_ids[choiceId];
        if (!outcomePatchId) {
          return { status: 422, body: { error: 'invalid_choice_mapping', code: 'INVALID_CHOICE_MAPPING' } };
        }

        const acceptedAt = new Date().toISOString();
        const acceptance = acceptMemberResponse({
          roster: participantRoster,
          collection: daily.response_collection,
          member: memberResolution.member,
          choice,
          acceptedAt,
        });

        if (acceptance.status === 'conflict') {
          return {
            status: 409,
            body: {
              error: 'RESPONSE_CONFLICT',
              code: 'RESPONSE_CONFLICT',
              responseCollection: acceptance.collection,
              readiness: acceptance.readiness,
            },
          };
        }

        const collectionAfterAcceptance = acceptance.collection;

        if (dailyStateJson.resolution) {
          return {
            status: 200,
            body: {
              campaignId,
              calendarDate,
              engineVersion,
              acceptedResponse: acceptance.response,
              responseStatus: acceptance.status,
              readiness: computeReadiness(participantRoster, collectionAfterAcceptance),
              responseCollection: collectionAfterAcceptance,
              resolution: dailyStateJson.resolution,
              newState: campaign.state_json,
              stateHash: campaign.state_hash,
              stateVersion: campaign.state_version,
            },
          };
        }

        const nextDailyWithoutResolution = {
          ...dailyStateJson,
          daily: {
            ...daily,
            participant_roster: participantRoster,
            response_collection: collectionAfterAcceptance,
          },
        };

        if (!acceptance.readiness.is_ready) {
          const nextDailyStateHash = sha256(canonicalJson(nextDailyWithoutResolution));
          await client.query(
            `UPDATE campaign_daily_state
             SET daily_state_json = $1::jsonb, daily_state_hash = $2
             WHERE campaign_id = $3 AND calendar_date = $4::date AND engine_version = $5`,
            [JSON.stringify(nextDailyWithoutResolution), nextDailyStateHash, campaignId, calendarDate, engineVersion]
          );
          return {
            status: acceptance.status === 'idempotent' ? 200 : 202,
            body: {
              campaignId,
              calendarDate,
              engineVersion,
              acceptedResponse: acceptance.response,
              responseStatus: acceptance.status,
              readiness: acceptance.readiness,
              responseCollection: collectionAfterAcceptance,
              stateMutated: false,
            },
          };
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
          members: campaign.state_json && campaign.state_json.members && typeof campaign.state_json.members === 'object'
            ? campaign.state_json.members
            : {},
        };
        const orderedResponses = orderedAcceptedResponses(participantRoster, collectionAfterAcceptance);
        let nextState = previousState;
        const orderedMemberResolutions = [];
        for (const acceptedResponse of orderedResponses) {
          const orderedChoice = choices.find((entry) => entry && entry.id === acceptedResponse.choice_id);
          if (!orderedChoice) {
            return { status: 422, body: { error: 'invalid_choice_mapping', code: 'INVALID_CHOICE_MAPPING' } };
          }
          const orderedOutcomePatchId = daily.choice_outcome_patch_ids[acceptedResponse.choice_id];
          if (!orderedOutcomePatchId) {
            return { status: 422, body: { error: 'invalid_choice_mapping', code: 'INVALID_CHOICE_MAPPING' } };
          }
          nextState = vn.applyOutcome(nextState, {
            turn_id: `${campaignId}:${calendarDate}:${acceptedResponse.member_id}`,
            choice_id: acceptedResponse.choice_id,
            outcome_patch_id: orderedOutcomePatchId,
            primary_domain: daily.challenge.primaryPressure && daily.challenge.primaryPressure.domain
              ? String(daily.challenge.primaryPressure.domain)
              : undefined,
            actor_chart_id: acceptedResponse.member_id,
            archetype_id: daily.challenge_archetype && daily.challenge_archetype.archetype_id
              ? String(daily.challenge_archetype.archetype_id)
              : undefined,
            pressure_polarity: daily.challenge && daily.challenge.primaryPressure && daily.challenge.primaryPressure.likelyShadowPattern
              ? String(daily.challenge.primaryPressure.likelyShadowPattern).replace('phase1_shadow:', '')
              : undefined,
            intensity_band: daily.challenge && daily.challenge.primaryPressure && daily.challenge.primaryPressure.intensityBand
              ? String(daily.challenge.primaryPressure.intensityBand)
              : undefined,
            transit_body: daily.challenge && daily.challenge.primaryPressure && daily.challenge.primaryPressure.transitBody
              ? String(daily.challenge.primaryPressure.transitBody)
              : undefined,
            natal_body: daily.challenge && daily.challenge.primaryPressure && daily.challenge.primaryPressure.natalBody
              ? String(daily.challenge.primaryPressure.natalBody)
              : undefined,
            natal_house: daily.challenge && daily.challenge.primaryPressure && Number.isFinite(daily.challenge.primaryPressure.natalHouse)
              ? Number(daily.challenge.primaryPressure.natalHouse)
              : undefined,
            aspect_type: daily.challenge && daily.challenge.primaryPressure && daily.challenge.primaryPressure.aspectType
              ? String(daily.challenge.primaryPressure.aspectType)
              : undefined,
          });
          const outcome = vn.buildChallengeOutcome({
            scene: daily.challenge,
            choice: orderedChoice,
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
          orderedMemberResolutions.push({
            member_id: acceptedResponse.member_id,
            user_id: acceptedResponse.user_id,
            choice_id: acceptedResponse.choice_id,
            outcome_patch_id: orderedOutcomePatchId,
            response_path_id: acceptedResponse.response_path_id,
            response_pattern_tag: acceptedResponse.response_pattern_tag,
            response_posture: acceptedResponse.response_posture,
            response_label: acceptedResponse.response_label,
            outcome,
          });
        }
        const newStateHash = vn.hashCanonicalJson(nextState);
        const resolution = {
          ordered_member_resolutions: orderedMemberResolutions,
          challenge_fingerprint: daily.challenge_fingerprint,
          state_hash_before: stateHashBefore,
          state_hash_after: newStateHash,
          response_count: orderedMemberResolutions.length,
          resolved_member_chart_ids: orderedMemberResolutions.map((entry) => entry.member_id),
          resolved_at: acceptedAt,
        };

        const nextDailyStateJson = {
          ...nextDailyWithoutResolution,
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
            acceptedResponse: acceptance.response,
            responseStatus: acceptance.status,
            readiness: acceptance.readiness,
            responseCollection: collectionAfterAcceptance,
            resolution,
            newState: nextState,
            stateHash: newStateHash,
            stateVersion: campaign.state_version + 1,
            stateMutated: true,
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
