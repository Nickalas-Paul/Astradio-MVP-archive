/**
 * One-off generator for docs/SYNASTRY-S5-LIBRARY-COVERAGE-INVENTORY.csv (S5 Stage A).
 * Run: node vnext/scripts/generate-s5-library-coverage-inventory.mjs
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const PLANET_ORDER = {
  PLUTO: 0,
  NEPTUNE: 1,
  URANUS: 2,
  SATURN: 3,
  JUPITER: 4,
  SUN: 5,
  MOON: 6,
  MERCURY: 7,
  VENUS: 8,
  MARS: 9,
};

const BODIES = Object.keys(PLANET_ORDER).sort((a, b) => PLANET_ORDER[a] - PLANET_ORDER[b]);
const ASPECT_TYPES = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];

function buildAspectKey(bodyA, bodyB, type) {
  const a = bodyA.toUpperCase();
  const b = bodyB.toUpperCase();
  const orderA = PLANET_ORDER[a] ?? 99;
  const orderB = PLANET_ORDER[b] ?? 99;
  const [first, second] = orderA <= orderB ? [a, b] : [b, a];
  return `${first}_${second}_${type.toUpperCase()}`;
}

function pairTokenFromBodies(b1, b2) {
  return buildAspectKey(b1, b2, 'conjunction').replace(/_CONJUNCTION$/, '');
}

function pairSalience([x, y]) {
  const s = new Set([x, y]);
  if (s.has('SUN') || s.has('MOON')) return 1;
  if (s.has('VENUS') || s.has('MARS')) return 2;
  if (s.has('MERCURY')) return 3;
  if (s.has('JUPITER') || s.has('SATURN')) return 4;
  return 5;
}

const allPairs = [];
for (let i = 0; i < BODIES.length; i++) {
  for (let j = i; j < BODIES.length; j++) {
    allPairs.push([BODIES[i], BODIES[j]]);
  }
}

const pairTokenToPair = new Map();
for (const p of allPairs) {
  pairTokenToPair.set(pairTokenFromBodies(p[0], p[1]), p);
}

/** Proposal v2 §9 proxy: Sun/Moon-involved pairs first by traditional teaching volume (canonical pair tokens = buildAspectKey order). */
const tier1BodyPairTeachingOrder = [
  'SUN_MOON',
  'SUN_MERCURY',
  'SUN_VENUS',
  'SUN_MARS',
  'JUPITER_SUN',
  'SATURN_SUN',
  'URANUS_SUN',
  'NEPTUNE_SUN',
  'PLUTO_SUN',
  'SUN_SUN',
  'MOON_MERCURY',
  'MOON_VENUS',
  'MOON_MARS',
  'JUPITER_MOON',
  'SATURN_MOON',
  'URANUS_MOON',
  'NEPTUNE_MOON',
  'PLUTO_MOON',
  'MOON_MOON',
];

const sal1Tokens = new Set(allPairs.filter((p) => pairSalience(p) === 1).map((p) => pairTokenFromBodies(p[0], p[1])));

const orderedSal1 = [];
const seen1 = new Set();
for (const tok of tier1BodyPairTeachingOrder) {
  if (sal1Tokens.has(tok) && !seen1.has(tok)) {
    seen1.add(tok);
    orderedSal1.push(tok);
  }
}
const restSal1 = [...sal1Tokens].filter((t) => !seen1.has(t)).sort((a, b) => a.localeCompare(b));
orderedSal1.push(...restSal1);

function sortedPairTokensForSalience(s) {
  return allPairs
    .filter((p) => pairSalience(p) === s)
    .map((p) => pairTokenFromBodies(p[0], p[1]))
    .sort((a, b) => a.localeCompare(b));
}

const globalPairOrder = [
  ...orderedSal1,
  ...sortedPairTokensForSalience(2),
  ...sortedPairTokensForSalience(3),
  ...sortedPairTokensForSalience(4),
  ...sortedPairTokensForSalience(5),
];

const globalKeyOrder = [];
for (const tok of globalPairOrder) {
  const p = pairTokenToPair.get(tok);
  if (!p) throw new Error(`Missing pair token: ${tok}`);
  for (const t of ASPECT_TYPES) {
    globalKeyOrder.push(buildAspectKey(p[0], p[1], t));
  }
}

if (globalKeyOrder.length !== 275) {
  throw new Error(`Expected 275 keys, got ${globalKeyOrder.length}`);
}

/** Keys present in merged ASPECT_INSIGHTS (vnext/projection/insight-library, 2026-05 inventory). */
const COVERED_KEYS = new Set([
  ...Object.keys({
    SUN_MOON_CONJUNCTION: 1,
    SUN_MOON_SEXTILE: 1,
    SUN_MOON_SQUARE: 1,
    SUN_MOON_TRINE: 1,
    SUN_MOON_OPPOSITION: 1,
    SUN_VENUS_CONJUNCTION: 1,
    SUN_VENUS_SEXTILE: 1,
    SUN_VENUS_SQUARE: 1,
    SUN_VENUS_TRINE: 1,
    SUN_VENUS_OPPOSITION: 1,
    SUN_MARS_CONJUNCTION: 1,
    SUN_MARS_SEXTILE: 1,
    SUN_MARS_SQUARE: 1,
    SUN_MARS_TRINE: 1,
    SUN_MARS_OPPOSITION: 1,
    MOON_VENUS_CONJUNCTION: 1,
    MOON_VENUS_SEXTILE: 1,
    MOON_VENUS_SQUARE: 1,
    MOON_VENUS_TRINE: 1,
    MOON_VENUS_OPPOSITION: 1,
    MOON_MARS_CONJUNCTION: 1,
    MOON_MARS_SEXTILE: 1,
    MOON_MARS_SQUARE: 1,
    MOON_MARS_TRINE: 1,
    MOON_MARS_OPPOSITION: 1,
    VENUS_MARS_CONJUNCTION: 1,
    VENUS_MARS_SEXTILE: 1,
    VENUS_MARS_SQUARE: 1,
    VENUS_MARS_TRINE: 1,
    VENUS_MARS_OPPOSITION: 1,
  }),
]);

const outers = ['SATURN', 'JUPITER', 'URANUS', 'NEPTUNE', 'PLUTO'];
const inners = ['SUN', 'MOON', 'VENUS', 'MARS'];
for (const outer of outers) {
  for (const inner of inners) {
    for (const typ of ASPECT_TYPES) {
      COVERED_KEYS.add(buildAspectKey(outer, inner, typ));
    }
  }
}

const rankIndex = new Map(globalKeyOrder.map((k, i) => [k, i]));
for (const k of globalKeyOrder) {
  if (!rankIndex.has(k)) rankIndex.set(k, globalKeyOrder.indexOf(k));
}

const tier1 = new Set(globalKeyOrder.slice(0, 24));
const tier2 = new Set(globalKeyOrder.slice(24, 24 + 46));

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

const rows = [
  'aspect_key,body_a,body_b,aspect_type,coverage_state,tier_1_candidate,tier_2_candidate,notes',
];

for (const aspectKey of globalKeyOrder) {
  const m = aspectKey.match(/^([A-Z]+)_([A-Z]+)_(CONJUNCTION|SEXTILE|SQUARE|TRINE|OPPOSITION)$/);
  if (!m) throw new Error(`Bad key ${aspectKey}`);
  const [, bodyA, bodyB, aspectType] = m;
  const covered = COVERED_KEYS.has(aspectKey);
  const coverageState = covered ? 'covered' : 'uncovered';
  const t1 = tier1.has(aspectKey);
  const t2 = tier2.has(aspectKey);
  let notes = '';
  if (t1 && t2) notes = 'ERROR_BOTH_TIERS';
  else if (t1 && !covered) notes = 'tier_1_proxy_scope_library_gap_v2';
  rows.push(
    [
      aspectKey,
      bodyA,
      bodyB,
      aspectType.toLowerCase(),
      coverageState,
      t1 ? 'true' : 'false',
      t2 ? 'true' : 'false',
      notes,
    ]
      .map(csvEscape)
      .join(',')
  );
}

const outPath = path.join(repoRoot, 'docs', 'SYNASTRY-S5-LIBRARY-COVERAGE-INVENTORY.csv');
fs.writeFileSync(outPath, rows.join('\n') + '\n', 'utf8');

const coveredRows = rows.slice(1).filter((r) => r.includes(',covered,')).length;
console.log('Wrote', outPath);
console.log('Rows', rows.length - 1, 'covered count', coveredRows, 'COVERED_SET', COVERED_KEYS.size);
console.log('tier1', tier1.size, 'tier2', tier2.size);
console.log('tier1 keys:', [...tier1].join(', '));
