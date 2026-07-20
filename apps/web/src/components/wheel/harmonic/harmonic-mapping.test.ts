import assert from 'node:assert/strict';
import test from 'node:test';
import { PLANET_COLORS } from '../../../core/planet-identity';
import type { AuraRawSnapshot } from '../aura-raw-snapshot';
import { ASPECT_LINE_COLOR, WHEEL_COLORS } from '../wheel-constants';
import {
  elementWarmth,
  isolationMultiplier,
  mapAspectArcs,
  mapPlanetSources,
  planetAmplitude,
  planetFrequency,
  resolveAspectColor,
  resolvePlanetColor,
} from './harmonic-mapping';

const planets: AuraRawSnapshot['planets'] = [
  { name: 'Sun', lon: 15 },
  { name: 'Moon', lon: 135 },
  { name: 'Mars', lon: 225 },
];

test('fixed frequencies and amplitudes follow the approved body mapping', () => {
  assert.equal(planetFrequency('Moon'), 8);
  assert.equal(planetFrequency('Pluto'), 1.5);
  assert.equal(planetAmplitude('Sun'), 1);
  assert.equal(planetAmplitude('Venus'), 0.75);
  assert.equal(planetAmplitude('Saturn'), 0.55);
  assert.equal(planetAmplitude('Neptune'), 0.4);
});

test('finite ephemeris speed maps into the bounded shader range', () => {
  assert.equal(planetFrequency('Moon', 14), 8);
  assert.ok(planetFrequency('Mercury', -1.2) >= 1.5);
  assert.ok(planetFrequency('Mercury', -1.2) <= 8);
});

test('planet and aspect colors resolve from shared repository tokens', () => {
  assert.equal(resolvePlanetColor('Sun'), PLANET_COLORS.sun);
  assert.equal(resolvePlanetColor('unknown'), WHEEL_COLORS.planetGlyphFill);
  assert.equal(resolveAspectColor('TRINE'), ASPECT_LINE_COLOR.trine);
  assert.equal(resolveAspectColor('unknown'), WHEEL_COLORS.outerRingStroke);
});

test('isolation applies the approved dramatic multipliers', () => {
  assert.equal(isolationMultiplier(2, -1), 1);
  assert.equal(isolationMultiplier(2, 2), 2.2);
  assert.equal(isolationMultiplier(1, 2), 0.05);
});

test('element distribution stays in the narrow warm range', () => {
  const fireHeavy = elementWarmth({ fire: 0.8, earth: 0.1, air: 0.05, water: 0.05 });
  const waterHeavy = elementWarmth({ fire: 0.05, earth: 0.05, air: 0.1, water: 0.8 });
  assert.ok(fireHeavy > waterHeavy);
  assert.ok(waterHeavy >= 0.35);
  assert.ok(fireHeavy <= 0.85);
});

test('chart mapping creates source positions and token-colored aspect arcs', () => {
  const sources = mapPlanetSources(planets);
  const arcs = mapAspectArcs(
    [{ bodies: ['Sun', 'Moon'], type: 'trine', orb: 1.2, strength: 0.9 }],
    sources,
  );

  assert.equal(sources.length, 3);
  assert.equal(sources[0]?.color, PLANET_COLORS.sun);
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0]?.fromIdx, 0);
  assert.equal(arcs[0]?.toIdx, 1);
  assert.equal(arcs[0]?.fromName, 'Sun');
  assert.equal(arcs[0]?.toName, 'Moon');
  assert.equal(arcs[0]?.orb, 1.2);
  assert.equal(arcs[0]?.color, ASPECT_LINE_COLOR.trine);
  assert.ok((arcs[0]?.influence ?? 0) > 0);
});
