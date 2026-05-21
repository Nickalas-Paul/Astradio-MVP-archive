/**
 * Batch 5c: Replace PLUTO_NEPTUNE_* and NEPTUNE_PLUTO_* with user deliverable prose.
 * Run: npx tsx vnext/scripts/apply-batch5c-pluto-neptune-replace.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const PLUTO = path.join(__dirname, '../projection/insight-library/insight-library-aspects-pluto.ts');
const NEPTUNE = path.join(__dirname, '../projection/insight-library/insight-library-aspects-neptune.ts');

function escapeForRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function loadFragment(name: string): Map<string, string> {
  const raw = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const map = new Map<string, string>();
  const re = /  ([A-Z][A-Z0-9_]+):\s*\{[\s\S]*?\n  \},/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) map.set(m[1]!, m[0]);
  return map;
}

function replaceEntry(filePath: string, key: string, newBlock: string): boolean {
  let src = fs.readFileSync(filePath, 'utf8');
  const keyRe = new RegExp(`\\n  ${escapeForRegex(key)}:\\s*\\{[\\s\\S]*?\\n  \\},`);
  if (!keyRe.test(src)) {
    console.error('MISSING', key, 'in', path.basename(filePath));
    return false;
  }
  src = src.replace(keyRe, `\n${newBlock}`);
  fs.writeFileSync(filePath, src, 'utf8');
  return true;
}

const plutoFrag = loadFragment('batch5c-pluto-neptune-fragment.txt');
const neptuneFrag = loadFragment('batch5c-neptune-pluto-fragment.txt');

const plutoKeys = [
  'PLUTO_NEPTUNE_CONJUNCTION',
  'PLUTO_NEPTUNE_OPPOSITION',
  'PLUTO_NEPTUNE_SQUARE',
  'PLUTO_NEPTUNE_TRINE',
  'PLUTO_NEPTUNE_SEXTILE',
];
const neptuneKeys = [
  'NEPTUNE_PLUTO_CONJUNCTION',
  'NEPTUNE_PLUTO_OPPOSITION',
  'NEPTUNE_PLUTO_SQUARE',
  'NEPTUNE_PLUTO_TRINE',
  'NEPTUNE_PLUTO_SEXTILE',
];

let ok = 0;
for (const key of plutoKeys) {
  const block = plutoFrag.get(key);
  if (!block) {
    console.error('FRAGMENT MISSING', key);
    continue;
  }
  if (replaceEntry(PLUTO, key, block)) {
    ok++;
    console.log('OK pluto', key);
  }
}
for (const key of neptuneKeys) {
  const block = neptuneFrag.get(key);
  if (!block) {
    console.error('FRAGMENT MISSING', key);
    continue;
  }
  if (replaceEntry(NEPTUNE, key, block)) {
    ok++;
    console.log('OK neptune', key);
  }
}

console.log({ ok, expected: 10 });
if (ok !== 10) process.exit(1);
