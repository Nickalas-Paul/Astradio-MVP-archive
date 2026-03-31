'use strict';

const { canonicalJson, sha256 } = require('./canonical-location');

function sortRosterEntries(entries) {
  return [...entries].sort((a, b) => a.chart_id.localeCompare(b.chart_id, 'en'));
}

function buildLockedParticipantRoster(entries) {
  const normalized = (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      user_id: typeof entry?.user_id === 'string' ? entry.user_id.trim() : '',
      chart_id: typeof entry?.chart_id === 'string' ? entry.chart_id.trim() : '',
    }))
    .filter((entry) => entry.user_id && entry.chart_id);

  if (normalized.length === 0) {
    throw new Error('PARTICIPANT_ROSTER_REQUIRED');
  }

  const byChart = new Map();
  const byUser = new Map();
  for (const entry of normalized) {
    if (byChart.has(entry.chart_id)) {
      throw new Error(`DUPLICATE_PARTICIPANT_CHART_ID:${entry.chart_id}`);
    }
    const existingUserCount = byUser.get(entry.user_id) || 0;
    byUser.set(entry.user_id, existingUserCount + 1);
    byChart.set(entry.chart_id, entry);
  }

  return sortRosterEntries(normalized).map((entry, index) => ({
    user_id: entry.user_id,
    chart_id: entry.chart_id,
    ordinal: index,
  }));
}

function buildInitialResponseCollection(roster) {
  const pending = roster.map((entry) => entry.chart_id);
  return {
    readiness_rule: 'all_members_responded',
    accepted_response_count: 0,
    members_total: roster.length,
    ready_member_chart_ids: [],
    pending_member_chart_ids: pending,
    accepted_responses: {},
  };
}

function normalizeResponseCollection(roster, rawCollection) {
  const collection = rawCollection && typeof rawCollection === 'object' ? rawCollection : {};
  const accepted = collection.accepted_responses && typeof collection.accepted_responses === 'object'
    ? collection.accepted_responses
    : {};

  const acceptedResponses = {};
  for (const member of roster) {
    const existing = accepted[member.chart_id];
    if (!existing || typeof existing !== 'object') continue;
    acceptedResponses[member.chart_id] = {
      member_id: member.chart_id,
      user_id: member.user_id,
      choice_id: typeof existing.choice_id === 'string' ? existing.choice_id : '',
      response_path_id: typeof existing.response_path_id === 'string' ? existing.response_path_id : '',
      response_pattern_tag: typeof existing.response_pattern_tag === 'string' ? existing.response_pattern_tag : '',
      canonical_response_hash: typeof existing.canonical_response_hash === 'string' ? existing.canonical_response_hash : '',
      accepted_at: typeof existing.accepted_at === 'string' ? existing.accepted_at : null,
    };
  }

  const ready = roster
    .map((member) => member.chart_id)
    .filter((chartId) => Boolean(acceptedResponses[chartId]));
  const pending = roster
    .map((member) => member.chart_id)
    .filter((chartId) => !acceptedResponses[chartId]);

  return {
    readiness_rule: 'all_members_responded',
    accepted_response_count: ready.length,
    members_total: roster.length,
    ready_member_chart_ids: ready,
    pending_member_chart_ids: pending,
    accepted_responses: acceptedResponses,
  };
}

function computeReadiness(roster, collection) {
  const normalized = normalizeResponseCollection(roster, collection);
  return {
    is_ready: normalized.pending_member_chart_ids.length === 0,
    accepted_response_count: normalized.accepted_response_count,
    members_total: normalized.members_total,
    ready_member_chart_ids: normalized.ready_member_chart_ids,
    pending_member_chart_ids: normalized.pending_member_chart_ids,
  };
}

function resolveRosterMember(roster, callerUserId) {
  const matches = roster.filter((member) => member.user_id === callerUserId);
  if (matches.length !== 1) {
    return { ok: false, error: 'INVALID_MEMBER', code: 'INVALID_MEMBER' };
  }
  return { ok: true, member: matches[0] };
}

function buildCanonicalMemberResponse(member, choice) {
  const canonicalPayload = {
    member_id: member.chart_id,
    user_id: member.user_id,
    choice_id: choice.id,
    response_path_id: choice.id,
    response_pattern_tag: choice.patternTag,
  };
  return {
    ...canonicalPayload,
    canonical_response_hash: sha256(canonicalJson(canonicalPayload)),
  };
}

function acceptMemberResponse(params) {
  const { roster, collection, member, choice, acceptedAt } = params;
  const normalized = normalizeResponseCollection(roster, collection);
  const canonicalResponse = buildCanonicalMemberResponse(member, choice);
  const existing = normalized.accepted_responses[member.chart_id];

  if (existing) {
    if (existing.canonical_response_hash === canonicalResponse.canonical_response_hash) {
      return {
        status: 'idempotent',
        collection: normalized,
        response: existing,
        readiness: computeReadiness(roster, normalized),
      };
    }
    return {
      status: 'conflict',
      collection: normalized,
      response: existing,
      readiness: computeReadiness(roster, normalized),
    };
  }

  const nextCollection = normalizeResponseCollection(roster, {
    ...normalized,
    accepted_responses: {
      ...normalized.accepted_responses,
      [member.chart_id]: {
        ...canonicalResponse,
        accepted_at: acceptedAt,
      },
    },
  });

  return {
    status: 'accepted',
    collection: nextCollection,
    response: nextCollection.accepted_responses[member.chart_id],
    readiness: computeReadiness(roster, nextCollection),
  };
}

function orderedAcceptedResponses(roster, collection) {
  const normalized = normalizeResponseCollection(roster, collection);
  const ordered = [];
  for (const member of roster) {
    const response = normalized.accepted_responses[member.chart_id];
    if (!response) {
      throw new Error(`MISSING_MEMBER_RESPONSE:${member.chart_id}`);
    }
    ordered.push(response);
  }
  return ordered;
}

module.exports = {
  acceptMemberResponse,
  buildCanonicalMemberResponse,
  buildInitialResponseCollection,
  buildLockedParticipantRoster,
  computeReadiness,
  normalizeResponseCollection,
  orderedAcceptedResponses,
  resolveRosterMember,
};
