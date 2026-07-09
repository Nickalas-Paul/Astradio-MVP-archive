/**
 * Shared gate: require x-proxy-secret when PROXY_SHARED_SECRET is set (Vercel → Render).
 * Mobile auth token exchange is exempt (no proxy secret on device clients).
 */

function isProxySecretExempt(req) {
  const original = (req.originalUrl || req.url || '').split('?')[0];
  if (original === '/api/auth/token') return true;
  const mounted = `${req.baseUrl || ''}${req.path || ''}`;
  if (mounted === '/api/auth/token' || mounted === '/auth/token') return true;

  // Public video export streaming: secured by 64-char export id; browser <video> cannot send proxy secret.
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') {
    const pathOnly = (req.originalUrl || req.url || '').split('?')[0];
    if (/\/api\/exports\/[a-f0-9]{64}$/i.test(pathOnly)) {
      const query = (req.originalUrl || req.url || '').includes('?')
        ? (req.originalUrl || req.url || '').slice((req.originalUrl || req.url || '').indexOf('?') + 1)
        : '';
      const format = String(new URLSearchParams(query).get('format') || '')
        .trim()
        .toLowerCase();
      if (format === 'mp4' || format === 'video') return true;
    }
  }

  return false;
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
