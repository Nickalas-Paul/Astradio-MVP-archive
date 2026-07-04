/**
 * Phase 1 audit: em dashes and double-hyphen dash substitutes in user-facing strings.
 * Run: node vnext/scripts/_audit-em-dashes.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const CONTENT_DIRS = [
  'vnext/projection/insight-library',
  'vnext/projection/insight',
  'vnext/projection/literals',
  'vnext/projection/rule-layer',
  'vnext/rpg/maps',
  'scripts',
  'vnext/scripts',
];

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === '__pycache__') continue;
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
  if (
    r.includes('insight-library') ||
    r.includes('projection/literals') ||
    r.includes('projection/insight') ||
    r.includes('rule-layer') ||
    r.includes('rpg/maps') ||
    (r.startsWith('scripts/') && r.endsWith('.json')) ||
    /apply-batch|surgical-|phase[0-9].*-signs\.json|phase[0-9].*-houses\.json/.test(r)
  ) {
    return 'content template';
  }
  if (r.startsWith('apps/web')) return 'UI string';
  if (r.endsWith('.sql') || (/seed/i.test(r) && /\.(mjs|js|sql|ts)$/.test(r))) return 'seed file';
  if (r.startsWith('vnext/') || r.startsWith('server/')) return 'API response';
  return 'other';
}

function extractStrings(line) {
  const results = [];
  const patterns = [/'([^'\\]|\\.)*'/g, /"([^"\\]|\\.)*"/g, /`([^`\\]|\\.)*`/g];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(line)) !== null) {
      results.push({ raw: m[0], inner: m[0].slice(1, -1), start: m.index });
    }
  }
  return results;
}

function isCommentOnlyLine(line) {
  const t = line.trim();
  return /^(\/\/|\/\*|\*|--)/.test(t);
}

function isCodeReference(line) {
  return /indexOf\(['"]—['"]\)/.test(line) || /endsWith\(['"]—['"]\)/.test(line);
}

function hasEmDash(s) {
  return s.includes('\u2014') || s.includes('\u2013');
}

function hasDoubleHyphenDash(s) {
  if (!s.includes('--')) return false;
  if (/https?:\/\//.test(s)) return false;
  if (/^['"`]?--[a-z]/.test(s)) return false;
  if (/[a-zA-Z0-9.,!?)]--[a-zA-Z0-9(]/.test(s)) return true;
  if (/ -- /.test(s)) return true;
  return false;
}

function collectFiles() {
  const files = new Set();
  const contentExts = ['.ts', '.js', '.json', '.tsx', '.sql', '.mjs'];
  for (const d of CONTENT_DIRS) {
    walk(path.join(ROOT, d), contentExts).forEach((f) => files.add(f));
  }
  walk(path.join(ROOT, 'apps/web'), ['.ts', '.tsx']).forEach((f) => files.add(f));
  for (const d of ['vnext', 'server']) {
    walk(path.join(ROOT, d), ['.ts', '.js']).forEach((f) => files.add(f));
  }
  walk(path.join(ROOT, 'migrations'), ['.sql']).forEach((f) => files.add(f));
  return [...files].sort();
}

const matches = [];

for (const file of collectFiles()) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  const lines = text.split(/\r?\n/);
  const category = classify(file);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (isCodeReference(line)) continue;

    const strings = extractStrings(line);
    if (strings.length === 0) {
      if (isCommentOnlyLine(line)) continue;
      continue;
    }

    for (const s of strings) {
      const em = hasEmDash(s.inner);
      const dh = hasDoubleHyphenDash(s.inner);
      if (!em && !dh) continue;

      if (isCommentOnlyLine(line) && (category === 'API response' || category === 'other')) continue;

      matches.push({
        file: rel(file),
        line: lineNo,
        dashType: em && dh ? 'em dash + double hyphen' : em ? 'em dash' : 'double hyphen',
        category,
        string: s.inner.length > 220 ? `${s.inner.slice(0, 217)}...` : s.inner,
      });
    }
  }
}

const seen = new Set();
const unique = matches.filter((m) => {
  const k = `${m.file}:${m.line}:${m.string.slice(0, 60)}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

const byCategory = {};
const byType = {};
for (const m of unique) {
  byCategory[m.category] = (byCategory[m.category] || 0) + 1;
  byType[m.dashType] = (byType[m.dashType] || 0) + 1;
}

const outPath = path.join(ROOT, 'vnext/scripts/_audit-em-dashes-output.json');
fs.writeFileSync(outPath, JSON.stringify({ total: unique.length, byCategory, byType, matches: unique }, null, 2));
console.log(`Wrote ${unique.length} matches to ${rel(outPath)}`);
console.log('byCategory:', byCategory);
console.log('byType:', byType);
