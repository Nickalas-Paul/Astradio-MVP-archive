/**
 * Shared gate: require x-proxy-secret when PROXY_SHARED_SECRET is set (Vercel → Render).
 * Mobile auth token exchange is exempt (no proxy secret on device clients).
 */

function isProxySecretExempt(req) {
  const original = (req.originalUrl || req.url || '').split('?')[0];
  if (original === '/api/auth/token') return true;
  const mounted = `${req.baseUrl || ''}${req.path || ''}`;
  return mounted === '/api/auth/token' || mounted === '/auth/token';
}

function proxySecretGate(req, res, next) {
  if (req.user?.id) return next();
  const PROXY_SECRET = process.env.PROXY_SHARED_SECRET;
  if (!PROXY_SECRET) return next();
  if (isProxySecretExempt(req)) return next();
  const provided = req.headers['x-proxy-secret'];
  if (provided !== PROXY_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

module.exports = { proxySecretGate, isProxySecretExempt };
