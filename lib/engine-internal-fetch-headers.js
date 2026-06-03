/**
 * Headers for engine process HTTP calls to its own /api/* routes (loopback).
 * Includes x-proxy-secret when PROXY_SHARED_SECRET is set (same as Vercel proxy).
 */

function engineInternalFetchHeaders(extra) {
  const headers = Object.assign({}, extra || {});
  const secret = process.env.PROXY_SHARED_SECRET;
  if (secret) headers['x-proxy-secret'] = secret;
  return headers;
}

module.exports = { engineInternalFetchHeaders };
