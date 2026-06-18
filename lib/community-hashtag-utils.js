/**
 * Extract hashtags from text.
 * Returns an array of unique lowercase tags without the # prefix.
 * Max tag length: 30 characters. Max tags per post: 10.
 */
function extractHashtags(text) {
  if (!text) return [];
  const matches = String(text).match(/#([a-zA-Z0-9_]{1,30})/g) || [];
  const tags = [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
  return tags.slice(0, 10);
}

module.exports = { extractHashtags };
