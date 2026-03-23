/**
 * Deterministic group daily anchor selection (no owner privilege, no randomness).
 */

const crypto = require('crypto');

function canonicalSortUserIds(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].filter((x) => typeof x === 'string' && x.trim()).sort((a, b) => a.localeCompare(b, 'en'));
}

/**
 * @param {string} campaignId
 * @param {string} calendarDate YYYY-MM-DD
 * @param {string} engineVersion
 * @param {string[]} participantUserIds
 * @returns {string[]} same users, order = fallback traversal starting at primary_index
 */
function anchorFallbackOrder(campaignId, calendarDate, engineVersion, participantUserIds) {
  const participants = canonicalSortUserIds(participantUserIds);
  const n = participants.length;
  if (n === 0) return [];

  const payload = `${campaignId}|${calendarDate}|${engineVersion}`;
  const hash = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
  const prefix = hash.slice(0, 8);
  const num = parseInt(prefix, 16);
  const primaryIndex = Number.isFinite(num) ? num % n : 0;

  const order = [];
  for (let i = 0; i < n; i++) {
    order.push(participants[(primaryIndex + i) % n]);
  }
  return order;
}

module.exports = {
  canonicalSortUserIds,
  anchorFallbackOrder,
};
