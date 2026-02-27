/**
 * Phase 4 — Chart vector storage. Thin wrapper over pg-store.
 * Raw SQL, no ORM. Fail-closed: throws if DB unavailable or table missing.
 * Used by vector-cache (write path) and compat matches (read path).
 */

const pgStore = require('./pg-store');

/**
 * Upsert a 64-D feature vector for a chart.
 * @param {Object} input
 * @param {string} input.chartId
 * @param {number[]} input.vector64 - array of 64 numbers
 * @param {string} [input.version='v1']
 * @param {string} [input.encoderVersion='v1']
 * @param {string} [input.snapshotHash]
 * @returns {Promise<{ chartId: string, version: string }>}
 */
async function upsertChartVector(input) {
  return pgStore.upsertChartVector(input);
}

/**
 * Get stored vector for a chart. Returns undefined if not found.
 * @param {string} chartId
 * @returns {Promise<{ chartId: string, vector64: number[], version: string, encoderVersion: string, snapshotHash?: string }|undefined>}
 */
async function getChartVector(chartId) {
  return pgStore.getChartVector(chartId);
}

/**
 * Get stored vectors for multiple charts. Returns Map chartId -> vector row.
 * Missing charts are omitted (no entry in map).
 * @param {string[]} chartIds
 * @returns {Promise<Map<string, { chartId: string, vector64: number[], version: string, encoderVersion: string }>>}
 */
async function getChartVectorsByIds(chartIds) {
  return pgStore.getChartVectorsByIds(chartIds);
}

module.exports = {
  upsertChartVector,
  getChartVector,
  getChartVectorsByIds,
};
