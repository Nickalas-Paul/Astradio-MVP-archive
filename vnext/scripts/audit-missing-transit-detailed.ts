/**
 * Missing transit field breakdown + Tier 1/3 flagged key check.
 * Run: npx tsx vnext/scripts/audit-missing-transit-detailed.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildAspectKey, getAspectInsight } from '../projection/insight-library/insight-library-index';
import { CORE_BODIES } from '../canonical-bodies';
import type { AspectInsight } from '../projection/insight-library/insight-library-types';

const ASPECTS = ['conjunction', 'opposition', 'square', 'trine', 'sextile'] as const;

const tier1Keys = [
  'MOON_MERCURY_OPPOSITION',
  'MERCURY_MARS_OPPOSITION',
  'MERCURY_MARS_SEXTILE',
  'MERCURY_VENUS_OPPOSITION',
  'MERCURY_VENUS_SEXTILE',
  'URANUS_MERCURY_CONJUNCTION',
  'URANUS_MERCURY_OPPOSITION',
  'URANUS_MERCURY_SQUARE',
  'URANUS_MERCURY_TRINE',
  'URANUS_MERCURY_SEXTILE',
  'NEPTUNE_MERCURY_CONJUNCTION',
  'NEPTUNE_MERCURY_OPPOSITION',
  'NEPTUNE_MERCURY_SQUARE',
  'NEPTUNE_MERCURY_TRINE',
  'NEPTUNE_MERCURY_SEXTILE',
  'PLUTO_MERCURY_CONJUNCTION',
  'PLUTO_MERCURY_OPPOSITION',
  'PLUTO_MERCURY_SQUARE',
  'PLUTO_MERCURY_TRINE',
  'PLUTO_MERCURY_SEXTILE',
];

const tier3Keys = [
  'URANUS_MERCURY_CONJUNCTION',
  'URANUS_MERCURY_OPPOSITION',
  'URANUS_MERCURY_SQUARE',
  'URANUS_MERCURY_TRINE',
  'URANUS_MERCURY_SEXTILE',
  'NEPTUNE_MERCURY_CONJUNCTION',
  'NEPTUNE_MERCURY_OPPOSITION',
  'NEPTUNE_MERCURY_SQUARE',
  'NEPTUNE_MERCURY_TRINE',
  'NEPTUNE_MERCURY_SEXTILE',
  'PLUTO_MERCURY_CONJUNCTION',
  'PLUTO_MERCURY_OPPOSITION',
  'PLUTO_MERCURY_SQUARE',
  'PLUTO_MERCURY_TRINE',
  'PLUTO_MERCURY_SEXTILE',
];

function fileForKey(key: string): string {
  if (key.includes('CHIRON')) return 'chiron.ts';
  if (key.includes('CERES')) return 'ceres.ts';
  if (key.includes('PALLAS')) return 'pallas.ts';
  if (key.includes('JUNO')) return 'juno.ts';
  if (key.includes('VESTA')) return 'vesta.ts';
  if (key.includes('MERCURY')) return 'mercury.ts';
  if (key.includes('JUPITER')) return 'jupiter.ts';
  if (key.includes('SATURN')) return 'saturn.ts';
  if (key.includes('URANUS')) return 'uranus.ts';
  if (key.includes('NEPTUNE')) return 'neptune.ts';
  if (key.includes('PLUTO')) return 'pluto.ts';
  return 'personal.ts';
}

function loadAspectInsightLibrary(): AspectInsight[] {
  const libDir = path.join(__dirname, '../projection/insight-library');
  const keys: string[] = [];
  for (const f of fs.readdirSync(libDir).filter((x) => x.startsWith('insight-library-aspects') && x.endsWith('.ts'))) {
    const txt = fs.readFileSync(path.join(libDir, f), 'utf8');
    for (const m of txt.matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*\{/gm)) keys.push(m[1]!);
  }
  const out: AspectInsight[] = [];
  for (const key of keys) {
    const ins = getAspectInsight(key);
    if (ins) out.push(ins);
  }
  return out;
}

function build450GridKeySet(): Set<string> {
  const set = new Set<string>();
  for (const tb of CORE_BODIES) {
    for (const nb of CORE_BODIES) {
      if (tb.toLowerCase() === nb.toLowerCase()) continue;
      for (const aspect of ASPECTS) set.add(buildAspectKey(tb, nb, aspect));
    }
  }
  return set;
}

const gridKeys = build450GridKeySet();
const aspectInsightLibrary = loadAspectInsightLibrary();

const results = {
  total_entries: 0,
  has_transit_fields: 0,
  missing_transit_fields: 0,
  missing_by_file: {} as Record<string, string[]>,
  tier1_flagged_have_transit: [] as string[],
  tier1_flagged_missing_transit: [] as string[],
  tier3_flagged_have_transit: [] as string[],
  tier3_flagged_missing_transit: [] as string[],
  missing_on_450_grid: [] as string[],
  missing_off_grid: [] as string[],
};

for (const entry of aspectInsightLibrary) {
  results.total_entries++;

  const hasTransit = !!(entry.core_transit?.trim() && entry.behavioral_transit?.trim());

  if (hasTransit) {
    results.has_transit_fields++;
  } else {
    results.missing_transit_fields++;

    const file = fileForKey(entry.key);
    if (!results.missing_by_file[file]) results.missing_by_file[file] = [];
    results.missing_by_file[file].push(entry.key);

    if (gridKeys.has(entry.key)) results.missing_on_450_grid.push(entry.key);
    else results.missing_off_grid.push(entry.key);
  }

  if (tier1Keys.includes(entry.key)) {
    if (hasTransit) results.tier1_flagged_have_transit.push(entry.key);
    else results.tier1_flagged_missing_transit.push(entry.key);
  }

  if (tier3Keys.includes(entry.key)) {
    if (hasTransit) results.tier3_flagged_have_transit.push(entry.key);
    else results.tier3_flagged_missing_transit.push(entry.key);
  }
}

// Sort for stable output
for (const k of Object.keys(results.missing_by_file)) {
  results.missing_by_file[k]!.sort();
}
results.missing_on_450_grid.sort();
results.missing_off_grid.sort();
results.tier1_flagged_have_transit.sort();
results.tier1_flagged_missing_transit.sort();
results.tier3_flagged_have_transit.sort();
results.tier3_flagged_missing_transit.sort();

console.log('MISSING TRANSIT FIELDS BREAKDOWN:');
console.log('=================================');
console.log(`Total entries: ${results.total_entries}`);
console.log(`Has transit fields: ${results.has_transit_fields}`);
console.log(`Missing transit fields: ${results.missing_transit_fields}`);
console.log(`  On 450-grid keys: ${results.missing_on_450_grid.length}`);
console.log(`  Off 450-grid keys: ${results.missing_off_grid.length}`);
console.log('');

console.log('Missing by file:');
for (const [file, keys] of Object.entries(results.missing_by_file).sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  ${file}: ${keys.length} entries`);
  console.log(`    ${keys.join(', ')}`);
}
console.log('');

console.log('Missing ON 450-grid (blocks feed grid transit copy for these slots):');
console.log(`  ${results.missing_on_450_grid.join(', ') || '(none)'}`);
console.log('');

console.log('Missing OFF 450-grid (synastry-only / asteroids / same-body):');
console.log(`  count: ${results.missing_off_grid.length}`);
console.log(`  ${results.missing_off_grid.join(', ')}`);
console.log('');

console.log('TIER 1 FLAGGED (20 keys):');
console.log(`  Have transit fields: ${results.tier1_flagged_have_transit.length}`);
console.log(`    ${results.tier1_flagged_have_transit.join(', ')}`);
console.log(`  Missing transit fields: ${results.tier1_flagged_missing_transit.length}`);
console.log(`    ${results.tier1_flagged_missing_transit.join(', ') || '(none)'}`);
console.log('');

console.log('TIER 3 FLAGGED (15 keys):');
console.log(`  Have transit fields: ${results.tier3_flagged_have_transit.length}`);
console.log(`    ${results.tier3_flagged_have_transit.join(', ')}`);
console.log(`  Missing transit fields: ${results.tier3_flagged_missing_transit.length}`);
console.log(`    ${results.tier3_flagged_missing_transit.join(', ') || '(none)'}`);
console.log('');

const outPath = path.join(__dirname, 'audit-missing-transit-detailed-output.json');
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.error('Wrote', outPath);
