/**
 * Strip em dashes (U+2014 only) from authoring scripts and JSON source files.
 * Preserves en-dashes (U+2013), standalone — placeholders, and markdown --- rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const SENTENCE_STARTERS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'when', 'where', 'what', 'who', 'whom',
  'which', 'why', 'how', 'if', 'as', 'so', 'but', 'and', 'or', 'yet', 'you', 'your', 'they',
  'their', 'we', 'our', 'it', 'its', 'he', 'she', 'there', 'here', 'use', 'being',
]);

function capitalizeStarter(word) {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function replaceEmDashClause(before, after) {
  const trimmed = after.trimStart();
  if (!trimmed) return `${before}.`;
  const firstWord = (trimmed.match(/^([A-Za-z]+)/)?.[1] || '').toLowerCase();
  if (/^[A-Z]/.test(trimmed)) {
    return `${before}. ${trimmed}`;
  }
  if (SENTENCE_STARTERS.has(firstWord)) {
    return `${before}. ${capitalizeStarter(trimmed)}`;
  }
  return `${before}, ${trimmed}`;
}

function stripEmDashesOnly(text) {
  let s = text;

  // Paired parenthetical em dashes
  for (let i = 0; i < 12; i++) {
    const next = s.replace(/([\w'”,.!?])—([^—\n]{1,100}?)—([\w'“])/g, '$1, $2, $3');
    if (next === s) break;
    s = next;
  }

  // Triple list: word—word—word (em dash only)
  s = s.replace(/\b(\w+)—(\w+)—(\w+)\b/g, '$1, $2, and $3');

  while (s.includes('—')) {
    const idx = s.indexOf('—');
    const before = s.slice(0, idx);
    const after = s.slice(idx + 1).trimStart();
    s = replaceEmDashClause(before, after);
  }

  s = s.replace(/\.\s+\./g, '.');
  s = s.replace(/,\s+,/g, ', ');
  s = s.replace(/,\s+\./g, '.');
  s = s.replace(/\.\s+,/g, ',');
  return s;
}

function isProtectedLine(line) {
  const t = line.trim();
  if (t === '—' || t === "'—'" || t === '"—"' || t === '`<span>—</span>`') return true;
  if (/^\.\.\.[A-Z_]+\s*,?\s*$/.test(t)) return true;
  return false;
}

function stripFileContent(content) {
  return content
    .split('\n')
    .map((line) => (isProtectedLine(line) ? line : stripEmDashesOnly(line)))
    .join('\n');
}

function collectTargets() {
  const out = [];
  const scriptsDir = path.join(ROOT, 'vnext/scripts');
  for (const name of fs.readdirSync(scriptsDir)) {
    if (/^apply-batch.*\.ts$/.test(name) || /^surgical-.*-feed.*\.ts$/.test(name)) {
      out.push(path.join(scriptsDir, name));
    }
  }
  const jsonDir = path.join(ROOT, 'scripts');
  for (const name of fs.readdirSync(jsonDir)) {
    if (/^phase[0-9].*-signs\.json$/.test(name) || /^phase[0-9].*-houses\.json$/.test(name)) {
      out.push(path.join(jsonDir, name));
    }
  }
  return out.sort();
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const files = collectTargets();
  let totalBefore = 0;
  let totalAfter = 0;
  let filesChanged = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const before = (raw.match(/—/g) || []).length;
    const next = stripFileContent(raw);
    const after = (next.match(/—/g) || []).length;
    totalBefore += before;
    totalAfter += after;
    if (before > 0) {
      console.log(`${path.relative(ROOT, file).replace(/\\/g, '/')}: ${before} -> ${after}`);
    }
    if (!dryRun && next !== raw) {
      fs.writeFileSync(file, next, 'utf8');
      filesChanged++;
    }
  }
  console.log(`\nEm dashes: ${totalBefore} -> ${totalAfter} (${filesChanged} files written, ${files.length} scanned)`);
  console.log(`Replacements: ${totalBefore - totalAfter}`);
}

main();
