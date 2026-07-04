/**
 * One-off: add engine-proxy-headers import and x-proxy-secret to Next API routes.
 */
const fs = require('fs');
const path = require('path');

const apiRoot = path.join(__dirname, '..', 'apps', 'web', 'app', 'api');
const skip = new Set([
  path.normalize(path.join(apiRoot, 'reverse-geocode', 'route.ts')),
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === 'route.ts') out.push(p);
  }
  return out;
}

const importLine =
  "import { engineProxyHeaders, engineProxySessionHeaders } from '@/lib/engine-proxy-headers';";

const updated = [];

for (const file of walk(apiRoot)) {
  if (skip.has(path.normalize(file))) continue;
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('engine-proxy-headers')) continue;
  if (!s.includes("getEngineBaseUrl") && !s.includes('ENGINE_BASE_URL')) continue;
  if (!s.includes("from '@/lib/engine-base'")) continue;

  s = s.replace(
    /import \{ getEngineBaseUrl \} from '@\/lib\/engine-base';/,
    `import { getEngineBaseUrl } from '@/lib/engine-base';\n${importLine}`,
  );

  // fetch(url) with no second arg
  s = s.replace(
    /await fetch\(([^,)]+)\)(?!\s*,)/g,
    (m, url) => {
      if (url.includes('engineProxyHeaders')) return m;
      return `await fetch(${url}, { headers: engineProxyHeaders() })`;
    },
  );

  // headers: { ... } without x-proxy-secret
  s = s.replace(/headers:\s*\{([^}]*)\}/g, (m, inner) => {
    if (inner.includes('x-proxy-secret') || inner.includes('engineProxy')) return m;
    const trimmed = inner.trim();
    if (!trimmed) return 'headers: engineProxyHeaders()';
    const sessionMatch = trimmed.match(/['"]x-proxy-session-user-id['"]\s*:\s*([^,\n}]+)/);
    if (sessionMatch) {
      const uid = sessionMatch[1].trim();
      let rest = trimmed
        .replace(/['"]x-proxy-session-user-id['"]\s*:\s*[^,\n}]+,?\s*/, '')
        .replace(/^,\s*/, '')
        .trim();
      if (rest.endsWith(',')) rest = rest.slice(0, -1).trim();
      const extraObj = rest ? `, ${rest}` : '';
      return `headers: engineProxySessionHeaders(${uid}${extraObj ? `, { ${rest} }` : ''})`;
    }
    const body = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
    return `headers: engineProxyHeaders({ ${body} })`;
  });

  fs.writeFileSync(file, s);
  updated.push(path.relative(process.cwd(), file));
}

console.log(JSON.stringify({ count: updated.length, files: updated }, null, 2));
