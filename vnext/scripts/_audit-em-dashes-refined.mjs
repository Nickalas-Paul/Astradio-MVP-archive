/**
 * Phase 1 audit (refined): user-facing em dashes only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '__pycache__', 'vendor', '_deprecated'].some((x) => ent.name === x)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => ent.name.endsWith(e))) out.push(p);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function classify(file) {
  const r = rel(file);
  if (r.includes('insight-library') || r.includes('projection/literals') || r.includes('projection/insight')) {
    return 'content template';
  }
  if (r.includes('rule-layer') || r.includes('rpg/maps') || r.endsWith('.json') && (r.startsWith('scripts/') || r.includes('maps/v1'))) {
    return 'content template';
  }
  if (/apply-batch|surgical-.*-feed|phase[0-9].*-signs\.json|phase[0-9].*-houses\.json/.test(r)) {
    return 'content template';
  }
  if (r.startsWith('apps/web')) return 'UI string';
  if (r.endsWith('.sql') || (/seed/i.test(r) && /\.(mjs|js|sql)$/.test(r))) return 'seed file';
  if (r.startsWith('vnext/') || r.startsWith('server/') || r.startsWith('lib/')) return 'API response';
  return 'excluded';
}

function isExcludedFile(r) {
  if (r.includes('_audit-em-dashes')) return true;
  if (r.includes('strip-library-em-dashes')) return true;
  if (/\.test\.(ts|js)$/.test(r)) return true;
  if (r.includes('/scripts/') && !r.includes('apply-batch') && !r.includes('surgical-') && !r.endsWith('.json')) {
    // vnext/scripts and scripts/* are mostly dev tooling unless content authoring
    if (/phase[0-9]|verify-|test-|smoke-|audit-|gate-|diag-|compose-golden|generate-real-snapshots/.test(r)) return true;
  }
  if (r.startsWith('apps/web/app/dev/')) return true;
  if (r.includes('_deprecated')) return true;
  return false;
}

function extractStrings(line) {
  const results = [];
  for (const re of [/'([^'\\]|\\.)*'/g, /"([^"\\]|\\.)*"/g, /`([^`\\]|\\.)*`/g]) {
    let m;
    while ((m = re.exec(line)) !== null) {
      results.push({ raw: m[0], inner: m[0].slice(1, -1) });
    }
  }
  return results;
}

function isCommentLine(line) {
  const t = line.trim();
  return /^(\/\/|\/\*|\*|--)/.test(t);
}

function hasEmDash(s) {
  return s.includes('\u2014') || s.includes('\u2013');
}

function hasDoubleHyphenDash(s) {
  if (!s.includes('--')) return false;
  if (/https?:\/\//.test(s)) return false;
  if (/^--[a-z]/.test(s)) return false;
  if (/[a-zA-Z0-9.,!?)]--[a-zA-Z0-9(]/.test(s)) return true;
  if (/ -- /.test(s)) return true;
  return false;
}

function isLikelyUserFacingString(inner, line, file) {
  if (isCommentLine(line)) return false;
  if (/console\.(log|warn|error)/.test(line)) return false;
  if (/indexOf\(['"]—['"]\)/.test(line)) return false;
  // Dev-only campaign debug strings
  if (inner.startsWith('[tone_track]') || inner.startsWith('[state]')) return true; // user asked for all UI - these are dev UI
  return true;
}

const dirs = [
  ['vnext/projection', ['.ts', '.json']],
  ['vnext/rpg/maps', ['.json']],
  ['vnext/community', ['.ts']],
  ['vnext/compatibility', ['.ts']],
  ['vnext/rpg', ['.ts']],
  ['vnext/api', ['.ts']],
  ['vnext/explainer', ['.ts', '.md']],
  ['server', ['.ts', '.js']],
  ['lib', ['.ts', '.js']],
  ['scripts', ['.json']],
  ['vnext/scripts', ['.ts']],
  ['apps/web', ['.ts', '.tsx']],
  ['migrations', ['.sql']],
];

const files = new Set();
for (const [d, exts] of dirs) walk(path.join(ROOT, d), exts).forEach((f) => files.add(f));
// content authoring scripts
walk(path.join(ROOT, 'vnext/scripts'), ['.ts']).filter((f) => /apply-batch|surgical-.*-feed/.test(rel(f))).forEach((f) => files.add(f));
walk(path.join(ROOT, 'scripts'), ['.js', '.mjs']).filter((f) => /seed/i.test(rel(f))).forEach((f) => files.add(f));
walk(path.join(ROOT, 'vnext/scripts'), ['.mjs']).filter((f) => /seed/i.test(rel(f))).forEach((f) => files.add(f));

const matches = [];
for (const file of [...files].sort()) {
  const r = rel(file);
  if (isExcludedFile(r)) continue;
  const category = classify(file);
  if (category === 'excluded') continue;

  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const s of extractStrings(line)) {
      if (!isLikelyUserFacingString(s.inner, line, file)) continue;
      const em = hasEmDash(s.inner);
      const dh = hasDoubleHyphenDash(s.inner);
      if (!em && !dh) continue;
      matches.push({
        file: r,
        line: i + 1,
        dashType: em && dh ? 'em dash + double hyphen' : em ? 'em dash' : 'double hyphen',
        category,
        string: s.inner.length > 240 ? `${s.inner.slice(0, 237)}...` : s.inner,
      });
    }
  }
}

const seen = new Set();
const unique = matches.filter((m) => {
  const k = `${m.file}:${m.line}:${m.string.slice(0, 80)}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const outPath = path.join(ROOT, 'vnext/scripts/_audit-em-dashes-refined.json');
fs.writeFileSync(outPath, JSON.stringify({ total: unique.length, matches: unique }, null, 2));

const byCat = {};
for (const m of unique) {
  byCat[m.category] = (byCat[m.category] || 0) + 1;
}
console.log(JSON.stringify({ total: unique.length, byCategory: byCat }, null, 2));
