/**
 * Strip em/en dashes from insight library prose (— U+2014, – U+2013).
 * Run: npx tsx vnext/scripts/strip-library-em-dashes.ts [--dry-run] [glob...]
 * Default: all insight-library-aspects-*.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const SENTENCE_STARTERS = new Set([
  'a',
  'an',
  'the',
  'this',
  'that',
  'these',
  'those',
  'when',
  'where',
  'what',
  'who',
  'whom',
  'which',
  'why',
  'how',
  'if',
  'as',
  'so',
  'but',
  'and',
  'or',
  'yet',
  'you',
  'your',
  'they',
  'their',
  'we',
  'our',
  'it',
  'its',
  'he',
  'she',
  'there',
  'here',
  'use',
  'being',
]);

function capitalizeStarter(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function replaceEmDashClause(before: string, after: string): string {
  const trimmed = after.trimStart();
  if (!trimmed) return before + '.';
  const firstWord = (trimmed.match(/^([A-Za-z]+)/)?.[1] || '').toLowerCase();
  if (/^[A-Z]/.test(trimmed)) {
    return `${before}. ${trimmed}`;
  }
  if (SENTENCE_STARTERS.has(firstWord)) {
    return `${before}. ${capitalizeStarter(trimmed)}`;
  }
  return `${before}, ${trimmed}`;
}

export function stripEmDashesInText(text: string): string {
  let s = text;

  // Comment/header titles: "Library — Name" -> "Library: Name"
  s = s.replace(/Insight Library — /g, 'Insight Library: ');
  s = s.replace(/Library — /g, 'Library: ');

  // En dash ranges and lists in comments: P1–P4, MOON–VENUS
  s = s.replace(/([A-Za-z0-9]+)–([A-Za-z0-9]+)/g, '$1 to $2');

  // Paired parenthetical em dashes (short middle segment)
  for (let i = 0; i < 12; i++) {
    const next = s.replace(
      /([\w'”,.!?])—([^—\n]{1,100}?)—([\w'“])/g,
      '$1, $2, $3'
    );
    if (next === s) break;
    s = next;
  }

  // Triple list: word—word—word
  s = s.replace(/\b(\w+)—(\w+)—(\w+)\b/g, '$1, $2, and $3');

  while (s.includes('—')) {
    const idx = s.indexOf('—');
    const before = s.slice(0, idx);
    const after = s.slice(idx + 1).trimStart();
    s = replaceEmDashClause(before, after);
  }

  // Remaining em dashes
  s = s.replace(/—/g, ', ');

  // Cleanup artifacts (prose only — never collapse leading indentation)
  s = s.replace(/\.\s+\./g, '.');
  s = s.replace(/,\s+,/g, ', ');
  s = s.replace(/,\s+\./g, '.');
  s = s.replace(/\.\s+,/g, ',');

  return s;
}

/** Skip object spread lines so comma/newline structure is never altered. */
function isProtectedLine(line: string): boolean {
  const t = line.trim();
  return /^\.\.\.[A-Z_]+\s*,?\s*$/.test(t);
}

function stripEmDashesInFileContent(content: string): string {
  const lines = content.split('\n');
  const out = lines.map((line) => (isProtectedLine(line) ? line : stripEmDashesInText(line)));
  return out.join('\n');
}

function processFile(filePath: string, dryRun: boolean): { before: number; after: number } {
  const raw = fs.readFileSync(filePath, 'utf8');
  const before = (raw.match(/—|–/g) || []).length;
  const next = stripEmDashesInFileContent(raw);
  const after = (next.match(/—|–/g) || []).length;
  if (!dryRun && next !== raw) {
    fs.writeFileSync(filePath, next, 'utf8');
  }
  return { before, after };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const root = path.resolve(process.cwd(), 'vnext/projection/insight-library');
  const unique =
    args.length > 0
      ? args.map((f) => path.resolve(f))
      : fs
          .readdirSync(root)
          .filter((name) => name.startsWith('insight-library-aspects-') && name.endsWith('.ts'))
          .map((name) => path.join(root, name))
          .sort();
  if (unique.length === 0) {
    console.error('No files matched');
    process.exit(1);
  }

  let totalBefore = 0;
  let totalAfter = 0;
  for (const file of unique) {
    const { before, after } = processFile(file, dryRun);
    totalBefore += before;
    totalAfter += after;
    if (before > 0) {
      console.log(`${dryRun ? '[dry-run] ' : ''}${path.basename(file)}: ${before} -> ${after}`);
    }
  }
  console.log(`Total em/en dashes: ${totalBefore} -> ${totalAfter} (${unique.length} files)`);
  if (dryRun) console.log('Dry run — no files written');
}

main();
