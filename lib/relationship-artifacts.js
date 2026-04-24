/**
 * Lazy materialization for saved pair connections: composite artifact (Stage 4) +
 * comparison row (compat compose) + export id, linked on astradio_relationships / astradio_comparisons.
 * Orchestrates existing engines only — no new compose pipelines.
 */

const path = require('path');
const crypto = require('crypto');
const pgStore = require('./pg-store');

const groupComposeAdapter = require(path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'relational', 'composition', 'group-compose-adapter'));
const { createComparison } = require(path.join(__dirname, '..', 'dist', 'vnext', 'vnext', 'compat', 'comparison-service'));

const REL_KIND_LABEL = {
  friend: 'Friend',
  lover: 'Lover',
  rival: 'Rival',
  collaborator: 'Collaborator',
};

function inferIntentKindFromLabel(label) {
  const s = String(label || '').trim();
  for (const k of Object.keys(REL_KIND_LABEL)) {
    if (REL_KIND_LABEL[k] === s) return k;
  }
  return null;
}

/** Maps intent relationship_kind → vnext RelationshipMode (compat compose). */
function relationshipModeForIntentKind(kind) {
  const k = kind && String(kind).trim().toLowerCase();
  if (k === 'lover') return 'lovers';
  if (k === 'rival') return 'rivals';
  if (k === 'collaborator') return 'collaborator';
  if (k === 'friend') return 'friends';
  return 'friends';
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function artifactHashFromPayload(payload) {
  return crypto.createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}

async function assertOwnedChart(ownerUserId, chartId) {
  const chart = await pgStore.getChart(chartId);
  return !!(chart && chart.ownerId === ownerUserId);
}

async function assertPairChartsAuthorizedForForecast(ownerUserId, chartIds) {
  if (!chartIds || chartIds.length !== 2) return false;
  if ((await assertOwnedChart(ownerUserId, chartIds[0])) && (await assertOwnedChart(ownerUserId, chartIds[1]))) {
    return true;
  }
  const [a, b] = chartIds;
  const lo = String(a).localeCompare(String(b), 'en') <= 0 ? a : b;
  const hi = lo === a ? b : a;
  const rel = await pgStore.findRelationshipByOwnerAndCharts(ownerUserId, lo, hi);
  return !!rel;
}

/**
 * Ensure astradio_composite_artifacts row exists (same logic as GET /api/relationships/:id/composite).
 */
async function ensurePairCompositeArtifact(ownerUserId, relationship) {
  const chartIds = [relationship.chartIdLow, relationship.chartIdHigh];
  const okPair = await assertPairChartsAuthorizedForForecast(ownerUserId, chartIds);
  if (!okPair) {
    const err = new Error('not_found');
    err.code = 'NOT_AUTHORIZED';
    throw err;
  }
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
      readingSnapshot: null,
      exportJobId: null,
    });
  }
  return { artifact, composed };
}

/**
 * @param {string} relationshipId
 * @param {string} ownerUserId
 * @returns {Promise<{ relationshipId: string, comparisonId: string | null, compositeArtifactId: string | null, exportJobId: string | null }>}
 */
async function materializeRelationshipArtifact(relationshipId, ownerUserId) {
  const relationship = await pgStore.getRelationshipById(relationshipId);
  if (!relationship || relationship.ownerUserId !== ownerUserId) {
    const err = new Error('not_found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const { artifact: compositeArtifact } = await ensurePairCompositeArtifact(ownerUserId, relationship);

  let comparisonId = relationship.comparisonId || null;

  if (!comparisonId) {
    const intentKind = await pgStore.findAcceptedIntentRelationshipKind(
      relationship.chartIdLow,
      relationship.chartIdHigh,
      relationship.label
    );
    const inferredKind = intentKind || inferIntentKindFromLabel(relationship.label);
    const relationshipMode = relationshipModeForIntentKind(inferredKind);

    const cmpResult = await createComparison({
      chartAId: relationship.chartIdLow,
      chartBId: relationship.chartIdHigh,
      relationshipMode,
      generateComposition: true,
      createdBy: ownerUserId,
    });

    comparisonId = cmpResult.comparison.id;
    await pgStore.updateRelationshipsComparisonIdForPair({
      chartIdLow: relationship.chartIdLow,
      chartIdHigh: relationship.chartIdHigh,
      label: relationship.label,
      comparisonId,
    });

    const exportId = cmpResult.exportId || null;
    if (exportId) {
      await pgStore.updateComparisonExportJobIfEmpty(comparisonId, exportId);
    }
  }

  let exportJobId = null;
  if (comparisonId) {
    const cmpRow = await pgStore.getComparison(comparisonId);
    exportJobId = cmpRow && cmpRow.exportJobId ? String(cmpRow.exportJobId) : null;
  }

  return {
    relationshipId,
    comparisonId,
    compositeArtifactId: compositeArtifact ? compositeArtifact.id : null,
    exportJobId,
  };
}

module.exports = {
  materializeRelationshipArtifact,
  ensurePairCompositeArtifact,
};
