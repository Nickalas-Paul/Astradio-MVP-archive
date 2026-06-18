/**
 * Direct messages feature gate (server).
 */

function isDirectMessagesEnabled() {
  return (
    process.env.ENABLE_DIRECT_MESSAGES === 'true' ||
    process.env.NEXT_PUBLIC_ENABLE_DIRECT_MESSAGES === 'true'
  );
}

function assertDirectMessagesEnabled(_req, res, next) {
  if (!isDirectMessagesEnabled()) {
    return res.status(501).json({ error: 'direct_messages_disabled' });
  }
  return next();
}

module.exports = {
  isDirectMessagesEnabled,
  assertDirectMessagesEnabled,
};
