/**
 * Batch 5b: Replace PLUTO_URANUS_* and URANUS_PLUTO_* with user deliverable prose.
 * Run: npx tsx vnext/scripts/apply-batch5b-pluto-uranus-replace.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const PLUTO = path.join(__dirname, '../projection/insight-library/insight-library-aspects-pluto.ts');
const URANUS = path.join(__dirname, '../projection/insight-library/insight-library-aspects-uranus.ts');

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

const plutoFrag = loadFragment('batch5b-pluto-uranus-fragment.txt');
const uranusFrag = loadFragment('batch5b-uranus-pluto-fragment.txt');

const plutoKeys = [
  'PLUTO_URANUS_CONJUNCTION',
  'PLUTO_URANUS_OPPOSITION',
  'PLUTO_URANUS_SQUARE',
  'PLUTO_URANUS_TRINE',
  'PLUTO_URANUS_SEXTILE',
];
const uranusKeys = [
  'URANUS_PLUTO_CONJUNCTION',
  'URANUS_PLUTO_OPPOSITION',
  'URANUS_PLUTO_SQUARE',
  'URANUS_PLUTO_TRINE',
  'URANUS_PLUTO_SEXTILE',
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
for (const key of uranusKeys) {
  const block = uranusFrag.get(key);
  if (!block) {
    console.error('FRAGMENT MISSING', key);
    continue;
  }
  if (replaceEntry(URANUS, key, block)) {
    ok++;
    console.log('OK uranus', key);
  }
}

console.log({ ok, expected: 10 });
if (ok !== 10) process.exit(1);
