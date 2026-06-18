/**
 * Optional Bearer JWT auth for /api routes (mobile direct-to-engine).
 * No-op when Authorization header absent — web proxy header flow unchanged.
 * Skips when x-proxy-session-user-id or x-proxy-secret present (Vercel BFF).
 */

const { verifyToken } = require('./authentication');

function bearerAuth(req, res, next) {
  if (req.headers['x-proxy-session-user-id'] || req.headers['x-proxy-secret']) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'token_invalid' });
  }

  const decoded = verifyToken(token);
  if (!decoded || decoded.type !== 'access' || !decoded.sub) {
    return res.status(401).json({ error: 'token_invalid' });
  }

  req.user = { id: String(decoded.sub).trim() };
  return next();
}

module.exports = { bearerAuth };
