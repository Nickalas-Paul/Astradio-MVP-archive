/**
 * Shared gate: require x-proxy-secret when PROXY_SHARED_SECRET is set (Vercel → Render).
 */

function proxySecretGate(req, res, next) {
  const PROXY_SECRET = process.env.PROXY_SHARED_SECRET;
  if (!PROXY_SECRET) return next();
  const provided = req.headers['x-proxy-secret'];
  if (provided !== PROXY_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
}

module.exports = { proxySecretGate };
