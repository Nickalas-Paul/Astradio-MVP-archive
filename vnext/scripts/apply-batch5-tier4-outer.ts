/**
 * Batch 5: Tier 4 outer×outer , insert 30 aspect entries into uranus/neptune/pluto files.
 * Run: npx tsx vnext/scripts/apply-batch5-tier4-outer.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const LIB = path.join(__dirname, '../projection/insight-library');

const INSERTS: Array<{ file: string; fragment: string; keys: string[] }> = [
  {
    file: 'insight-library-aspects-neptune.ts',
    fragment: 'batch5-neptune-uranus-fragment.txt',
    keys: [
      'NEPTUNE_URANUS_CONJUNCTION',
      'NEPTUNE_URANUS_OPPOSITION',
      'NEPTUNE_URANUS_SQUARE',
      'NEPTUNE_URANUS_TRINE',
      'NEPTUNE_URANUS_SEXTILE',
      'NEPTUNE_PLUTO_CONJUNCTION',
      'NEPTUNE_PLUTO_OPPOSITION',
      'NEPTUNE_PLUTO_SQUARE',
      'NEPTUNE_PLUTO_TRINE',
      'NEPTUNE_PLUTO_SEXTILE',
    ],
  },
  {
    file: 'insight-library-aspects-uranus.ts',
    fragment: 'batch5-uranus-neptune-fragment.txt',
    keys: [
      'URANUS_NEPTUNE_CONJUNCTION',
      'URANUS_NEPTUNE_OPPOSITION',
      'URANUS_NEPTUNE_SQUARE',
      'URANUS_NEPTUNE_TRINE',
      'URANUS_NEPTUNE_SEXTILE',
      'URANUS_PLUTO_CONJUNCTION',
      'URANUS_PLUTO_OPPOSITION',
      'URANUS_PLUTO_SQUARE',
      'URANUS_PLUTO_TRINE',
      'URANUS_PLUTO_SEXTILE',
    ],
  },
  {
    file: 'insight-library-aspects-pluto.ts',
    fragment: 'batch5-pluto-uranus-fragment.txt',
    keys: [
      'PLUTO_URANUS_CONJUNCTION',
      'PLUTO_URANUS_OPPOSITION',
      'PLUTO_URANUS_SQUARE',
      'PLUTO_URANUS_TRINE',
      'PLUTO_URANUS_SEXTILE',
      'PLUTO_NEPTUNE_CONJUNCTION',
      'PLUTO_NEPTUNE_OPPOSITION',
      'PLUTO_NEPTUNE_SQUARE',
      'PLUTO_NEPTUNE_TRINE',
      'PLUTO_NEPTUNE_SEXTILE',
    ],
  },
];

function loadFragment(name: string): Map<string, string> {
  const raw = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const map = new Map<string, string>();
  const re = /  ([A-Z][A-Z0-9_]+):\s*\{[\s\S]*?\n  \},/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) map.set(m[1]!, m[0]);
  return map;
}

function loadMergedFragments(names: string[]): Map<string, string> {
  const merged = new Map<string, string>();
  for (const name of names) {
    for (const [k, v] of loadFragment(name)) merged.set(k, v);
  }
  return merged;
}

function insertBeforeClose(filePath: string, blocks: string[]): void {
  let src = fs.readFileSync(filePath, 'utf8');
  const anchor = /\n\} as const;\s*$/;
  if (!anchor.test(src)) {
    console.error('NO ANCHOR', path.basename(filePath));
    process.exit(1);
  }
  const body = blocks.map((b) => `\n${b}`).join('');
  src = src.replace(anchor, `${body}\n} as const;\n`);
  fs.writeFileSync(filePath, src, 'utf8');
}

let ok = 0;
const expected = 30;

for (const spec of INSERTS) {
  const fragNames =
    spec.file === 'insight-library-aspects-neptune.ts'
      ? ['batch5-neptune-uranus-fragment.txt', 'batch5-neptune-pluto-fragment.txt']
      : spec.file === 'insight-library-aspects-uranus.ts'
        ? ['batch5-uranus-neptune-fragment.txt', 'batch5-uranus-pluto-fragment.txt']
        : ['batch5-pluto-uranus-fragment.txt', 'batch5-pluto-neptune-fragment.txt'];
  const fragment = loadMergedFragments(fragNames);
  const blocks: string[] = [];
  for (const key of spec.keys) {
    const block = fragment.get(key);
    if (!block) {
      console.error('FRAGMENT MISSING', key);
      continue;
    }
    blocks.push(block);
    ok++;
    console.log('OK', key);
  }
  insertBeforeClose(path.join(LIB, spec.file), blocks);
}

console.log({ ok, expected });
if (ok !== expected) process.exit(1);
