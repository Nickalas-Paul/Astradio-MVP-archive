/**
 * Insert Batch 2 Tier 2 entries (SATURN_JUPITER ×5, SATURN_URANUS ×5).
 * Run: npx tsx vnext/scripts/apply-batch2-tier2-feed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
const JUPITER = path.join(__dirname, '../projection/insight-library/insight-library-aspects-jupiter.ts');
const SATURN = path.join(__dirname, '../projection/insight-library/insight-library-aspects-saturn.ts');

/** Read raw entry block from fragment file (skips TS export wrapper lines). */
function loadFragment(name: string): string {
  const raw = fs.readFileSync(path.join(__dirname, name), 'utf8');
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((l: string) => l.trim().startsWith('SATURN_'));
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i]!.trim();
    if (t === '},') {
      end = i;
      break;
    }
  }
  if (start < 0 || end < 0) throw new Error(`Bad fragment ${name}`);
  return lines.slice(start, end + 1).join('\n');
}

const BATCH2_JUPITER_FRAGMENT = loadFragment('batch2-jupiter-fragment.txt');
const BATCH2_SATURN_FRAGMENT = loadFragment('batch2-saturn-fragment.txt');

function insertBeforeClose(filePath: string, fragment: string): void {
  let src = fs.readFileSync(filePath, 'utf8');
  if (src.includes('SATURN_JUPITER_CONJUNCTION') || src.includes('SATURN_URANUS_CONJUNCTION')) {
    const hasJupiter = src.includes('SATURN_JUPITER_CONJUNCTION');
    const hasSaturn = src.includes('SATURN_URANUS_CONJUNCTION');
    if (
      (filePath.includes('jupiter') && hasJupiter) ||
      (filePath.includes('saturn') && hasSaturn)
    ) {
      console.log('SKIP already present:', filePath);
      return;
    }
  }
  if (!/\n\} as const;\s*$/.test(src)) {
    throw new Error(`Expected "} as const;" footer in ${filePath}`);
  }
  src = src.replace(/\n\} as const;\s*$/, `\n${fragment}\n} as const;`);
  fs.writeFileSync(filePath, src, 'utf8');
  console.log('OK', filePath);
}

insertBeforeClose(JUPITER, BATCH2_JUPITER_FRAGMENT);
insertBeforeClose(SATURN, BATCH2_SATURN_FRAGMENT);
