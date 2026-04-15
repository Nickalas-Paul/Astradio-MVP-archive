#!/usr/bin/env node
/**
 * System Safety: fail if any `vnext/projection` TypeScript source imports campaign state modules.
 */
import * as fs from 'fs';
import * as path from 'path';

function findRepoRoot(start: string): string {
  let d = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'package.json'))) return d;
    const next = path.join(d, '..');
    if (next === d) break;
    d = next;
  }
  throw new Error('[check-projection-campaign-state-policy] could not find repo root');
}

function walkTsFiles(dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkTsFiles(p, out);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(p);
  }
}

function checkFile(filePath: string): string[] {
  const root = findRepoRoot(__dirname);
  const rel = path.relative(root, filePath);
  const raw = fs.readFileSync(filePath, 'utf8');
  const violations: string[] = [];

  const importCampaignStatePath = /from\s+['"]([^'"]*(?:campaign-state|rpg\/campaign\/state-machine)['"])/;
  const requireCampaignStatePath = /require\s*\(\s*['"]([^'"]*(?:campaign-state|rpg\/campaign\/state-machine)['"])\s*\)/;

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*')) continue;
    if (importCampaignStatePath.test(line)) {
      violations.push(`${rel}: forbidden campaign state import: ${line.trim()}`);
    }
    if (requireCampaignStatePath.test(line)) {
      violations.push(`${rel}: forbidden campaign state require: ${line.trim()}`);
    }
  }

  return violations;
}

export function verifyProjectionCampaignStatePolicy(): void {
  const root = findRepoRoot(__dirname);
  const projectionSrc = path.join(root, 'vnext', 'projection');
  const files: string[] = [];
  walkTsFiles(projectionSrc, files);
  const all: string[] = [];
  for (const f of files) {
    all.push(...checkFile(f));
  }
  if (all.length > 0) {
    throw new Error(`[check-projection-campaign-state-policy] FAIL\n${all.join('\n')}`);
  }
}

function main(): void {
  try {
    verifyProjectionCampaignStatePolicy();
    // eslint-disable-next-line no-console
    console.log('[check-projection-campaign-state-policy] OK');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
