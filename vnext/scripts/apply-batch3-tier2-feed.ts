/**
 * Insert Batch 3 Tier 2 outer-planet entries.
 * Run: npx tsx vnext/scripts/apply-batch3-tier2-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const JUPITER = path.join(__dirname, '../projection/insight-library/insight-library-aspects-jupiter.ts');
const SATURN = path.join(__dirname, '../projection/insight-library/insight-library-aspects-saturn.ts');

function loadFragment(name: string): string {
  const raw = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((l: string) => /^\s+(URANUS|NEPTUNE|PLUTO)_/.test(l));
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i]!.trim() === '},') {
      end = i;
      break;
    }
  }
  if (start < 0 || end < 0) throw new Error(`Bad fragment ${name}`);
  return lines.slice(start, end + 1).join('\n');
}

function insertBeforeClose(filePath: string, fragment: string, marker: string): void {
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes(marker)) {
    console.log('SKIP already present:', marker, 'in', path.basename(filePath));
    return;
  }
  if (!/\n\} as const;\s*$/.test(src)) {
    throw new Error(`Expected "} as const;" footer in ${filePath}`);
  }
  src = src.replace(/\n\} as const;\s*$/, `\n${fragment}\n} as const;`);
  fs.writeFileSync(filePath, src, 'utf8');
  console.log('OK', path.basename(filePath), marker);
}

const jup = loadFragment('batch3-jupiter-fragment.txt');
const sat = loadFragment('batch3-saturn-fragment.txt');
insertBeforeClose(JUPITER, jup, 'URANUS_JUPITER_CONJUNCTION');
insertBeforeClose(SATURN, sat, 'NEPTUNE_SATURN_CONJUNCTION');
