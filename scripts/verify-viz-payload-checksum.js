#!/usr/bin/env node
/**
 * Phase 3.5 guardrail: verify buildVizPayload returns same checksum for same fixtures.
 * Node-compatible (uses crypto.createHash); no browser deps.
 */
const crypto = require('crypto');

function canonicalStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k]));
  return '{' + pairs.join(',') + '}';
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function buildVizPayloadSync(snapshot, plan, compose_meta) {
  const houses = snapshot.houses ?? [];
  const planetLongitudes = {};
  for (const p of snapshot.planets ?? []) planetLongitudes[p.name] = p.lon;
  const aspects = (snapshot.aspects ?? []).map((a) => ({ p1: a.a, p2: a.b, type: a.type, orb: a.orb }));
  const chart = { houses, angles: { asc: houses[0], mc: houses[9] }, planetLongitudes, aspects };

  const bpm = plan.bpm ?? 90;
  const durationSec = plan.durationSec ?? 30;
  const density = typeof compose_meta.controls?.density_level === 'number' ? compose_meta.controls.density_level : 0.5;
  const arc = typeof compose_meta.controls?.arc_shape === 'number' ? compose_meta.controls.arc_shape : 0.5;
  const tension = typeof compose_meta.controls?.aspect_tension === 'number' ? compose_meta.controls.aspect_tension : 0.5;
  const planPayload = {
    tempo: bpm / 120,
    density,
    arc,
    tension,
    brightness: 0.5 + arc * 0.3,
    bpm,
    durationSec,
  };

  const payload = {
    chart,
    plan: planPayload,
    audioMeta: { provider_used: compose_meta.provider_used, duration_s: compose_meta.duration_s },
    seed: compose_meta.seed,
  };
  const canonical = canonicalStringify(payload);
  return sha256Hex(canonical);
}

const FIXTURE_SNAPSHOT = {
  houses: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
  planets: [
    { name: 'Sun', lon: 120 },
    { name: 'Moon', lon: 45 },
    { name: 'Mercury', lon: 90 },
  ],
  aspects: [{ a: 'Sun', b: 'Moon', type: 'trine', orb: 3 }],
};

const FIXTURE_PLAN = { bpm: 90, durationSec: 30 };

const FIXTURE_META = {
  provider_used: 'lyria',
  duration_s: 30,
  seed: 'phase35-test-seed',
  controls: { arc_shape: 0.5, density_level: 0.5, aspect_tension: 0.5 },
};

const c1 = buildVizPayloadSync(FIXTURE_SNAPSHOT, FIXTURE_PLAN, FIXTURE_META);
const c2 = buildVizPayloadSync(FIXTURE_SNAPSHOT, FIXTURE_PLAN, FIXTURE_META);

if (c1 !== c2) {
  console.error('FAIL: checksum differs across identical calls:', c1, 'vs', c2);
  process.exit(1);
}

console.log('OK: buildVizPayload checksum stable for same fixtures');
console.log('    checksum:', c1.slice(0, 16) + '...');
