const COMMUNITY_RELATIONAL_EXPRESSION_VERSION = 'community_relational_expression_v1';

function readRelationalExpressionVersionFromDailyArtifact(row) {
  if (!row || typeof row !== 'object') return null;
  const weatherPayload = row.weatherPayload;
  if (!weatherPayload || typeof weatherPayload !== 'object') return null;
  const meta = weatherPayload.meta;
  if (!meta || typeof meta !== 'object') return null;
  const value = meta.expressionVersion;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function buildRelationalFreshness(currentVersion, artifactVersion) {
  const current = String(currentVersion || '').trim();
  const artifact = String(artifactVersion || '').trim();
  if (!artifact) {
    return {
      isCurrent: false,
      isHistorical: true,
      reason: 'missing_version',
      currentVersion: current || null,
      artifactVersion: null,
    };
  }
  if (!current || artifact === current) {
    return {
      isCurrent: true,
      isHistorical: false,
      reason: null,
      currentVersion: current || artifact,
      artifactVersion: artifact,
    };
  }
  return {
    isCurrent: false,
    isHistorical: true,
    reason: 'version_mismatch',
    currentVersion: current,
    artifactVersion: artifact,
  };
}

module.exports = {
  COMMUNITY_RELATIONAL_EXPRESSION_VERSION,
  readRelationalExpressionVersionFromDailyArtifact,
  buildRelationalFreshness,
};
