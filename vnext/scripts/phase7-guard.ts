#!/usr/bin/env node
/**
 * Phase 7 — RPG isolation and determinism guard.
 *
 * Enforces (for all code under vnext/rpg/):
 * - No imports of vnext/core/architecture-engine
 * - No imports of vnext/feature-encode
 * - No references to generateArchitecture
 * - No use of Math.random or Date.now
 *
 * Enforces (for RPG migrations):
 * - Any migration file whose name includes "rpg" must not touch protected tables
 *   such as astradio_charts, astradio_chart_vectors, or compat/community tables.
 */

import * as fs from 'fs';
import * as path from 'path';

function findRepoRoot(): string {
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(__dirname, '../../../../../'); // fallback
}

const REPO_ROOT = findRepoRoot();

function readFileOrNull(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function walkDir(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (exts.some((ext) => e.name.endsWith(ext))) {
        out.push(full);
      }
    }
  }
  return out;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function checkRpgIsolation(): void {
  const rpgDir = path.join(REPO_ROOT, 'vnext', 'rpg');
  if (!fs.existsSync(rpgDir)) {
    console.log('[phase7-guard] vnext/rpg/ does not exist yet; skipping RPG isolation checks');
    return;
  }

  const files = walkDir(rpgDir, ['.ts', '.js']);
  if (files.length === 0) {
    console.log('[phase7-guard] vnext/rpg/ is empty; skipping RPG isolation checks');
    return;
  }

  const forbiddenImportPatterns: RegExp[] = [
    /from\s+['"].*core\/architecture-engine['"]/,
    /import\s+.*['"].*core\/architecture-engine['"]/,
    /require\s*\(\s*['"].*core\/architecture-engine['"]\s*\)/,
    /from\s+['"].*feature-encode['"]/,
    /import\s+.*['"].*feature-encode['"]/,
    /require\s*\(\s*['"].*feature-encode['"]\s*\)/,
  ];

  const forbiddenSymbolPatterns: RegExp[] = [
    /\bgenerateArchitecture\s*\(/,
    /Math\.random\s*\(/,
    /Date\.now\s*\(/,
  ];

  const forbiddenAudioImportPatterns: RegExp[] = [
    /from\s+['"][^'"]*lyria[^'"]*['"]/,
    /import\s+.*['"][^'"]*lyria[^'"]*['"]/,
    /require\s*\(\s*['"][^'"]*lyria[^'"]*['"]\s*\)/,
    /from\s+['"][^'"]*@google-cloud[^'"]*['"]/,
    /import\s+.*['"][^'"]*@google-cloud[^'"]*['"]/,
    /require\s*\(\s*['"][^'"]*@google-cloud[^'"]*['"]\s*\)/,
  ];

  for (const f of files) {
    const rel = path.relative(REPO_ROOT, f);
    const content = readFileOrNull(f);
    if (content == null) continue;

    for (const re of forbiddenImportPatterns) {
      if (re.test(content)) {
        fail(`[phase7-guard] Forbidden engine import in ${rel}: ${re}`);
      }
    }

    for (const re of forbiddenAudioImportPatterns) {
      if (re.test(content)) {
        fail(`[phase7-guard] Forbidden audio provider import in ${rel}: ${re}`);
      }
    }

    for (const re of forbiddenSymbolPatterns) {
      if (re.test(content)) {
        fail(`[phase7-guard] Forbidden symbol usage in ${rel}: ${re}`);
      }
    }
  }

  console.log('[phase7-guard] RPG isolation: no forbidden imports or symbols under vnext/rpg/');
}

const PROTECTED_TABLE_PATTERNS: RegExp[] = [
  /\bastradio_charts\b/i,
  /\bastradio_chart_vectors\b/i,
  /\bastradio_compat\b/i,
  /\bastradio_relational\b/i,
  /\bastradio_groups\b/i,
  /\bastradio_memberships\b/i,
  /\bastradio_community\b/i,
];

function checkRpgMigrations(): void {
  const migrationsDir = path.join(REPO_ROOT, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.log('[phase7-guard] migrations/ directory not found; skipping RPG migration checks');
    return;
  }

  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
  const sqlFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql') && e.name.toLowerCase().includes('rpg'))
    .map((e) => path.join(migrationsDir, e.name));

  if (sqlFiles.length === 0) {
    console.log('[phase7-guard] No RPG-specific migration files found; skipping protected-table check');
    return;
  }

  for (const full of sqlFiles) {
    const rel = path.relative(REPO_ROOT, full);
    const content = readFileOrNull(full);
    if (!content) continue;
    for (const re of PROTECTED_TABLE_PATTERNS) {
      if (re.test(content)) {
        fail(`[phase7-guard] RPG migration must not touch protected tables (${re}): ${rel}`);
      }
    }
  }

  console.log('[phase7-guard] RPG migrations: no references to protected tables');
}

function main(): void {
  console.log('[phase7-guard] Running Phase 7 RPG guard checks...');
  checkRpgIsolation();
  checkRpgMigrations();
  console.log('[phase7-guard] All Phase 7 guards passed.');
}

main();

