/**
 * Engine loopback HTTP headers (x-proxy-secret when PROXY_SHARED_SECRET is set).
 * Resolved from project root so dist/vnext/vnext/* and source paths both work.
 */
import path from 'path';

type HeadersFn = (extra?: Record<string, string>) => Record<string, string>;

function loadHeadersFn(): HeadersFn {
  const mod = require(path.join(process.cwd(), 'lib', 'engine-internal-fetch-headers')) as {
    engineInternalFetchHeaders: HeadersFn;
  };
  return mod.engineInternalFetchHeaders;
}

export function engineInternalFetchHeaders(extra?: Record<string, string>): Record<string, string> {
  return loadHeadersFn()(extra);
}
