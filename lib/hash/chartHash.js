"use strict";
// Single source of truth for chart hash generation
// Deterministic hashing for astrological chart data
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChartHash = generateChartHash;
exports.generateChartHashSync = generateChartHashSync;
const hash_1 = require("../../src/core/hash");
/**
 * Generate deterministic hash for chart data
 * Used for deduplication and caching
 */
async function generateChartHash(chartData) {
    const normalized = (0, hash_1.stableStringify)(chartData);
    return await (0, hash_1.sha256Hex)(normalized);
}
/**
 * Synchronous version for compatibility
 */
function generateChartHashSync(chartData) {
    const normalized = (0, hash_1.stableStringify)(chartData);
    // Use crypto.createHash for sync version
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
