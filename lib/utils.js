/**
 * Consolidated utility functions for Astradio
 * Eliminates duplication across server/index.js, vnext/api/compose.ts, and src/core/viz/engine.ts
 */

/**
 * Deterministic RNG (xorshift32) seeded by a string
 * Used for consistent random generation across all engines
 */
function createSeededRNG(seedStr) {
  let seed = 0;
  for (let i = 0; i < String(seedStr).length; i++) {
    seed = (seed ^ String(seedStr).charCodeAt(i)) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909) >>> 0;
  }
  if (seed === 0) seed = 0x9E3779B9;
  let state = seed >>> 0;
  
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5;  state >>>= 0;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * Swiss Ephemeris planet constants
 * Centralized to avoid duplication across files
 */
const PLANETS = {
  sun: 0,
  moon: 1,
  mercury: 2,
  venus: 3,
  mars: 4,
  jupiter: 5,
  saturn: 6,
  uranus: 7,
  neptune: 8,
  pluto: 9
};

const EXTRAS = {
  chiron: 15,
  lilith: 11, // Mean Black Moon Lilith
  northNode: 11,
  ceres: 16,
  juno: 17,
  vesta: 18,
  pallas: 19
};

/**
 * Generate hash for deterministic variation
 */
function generateHash(data) {
  const crypto = require('crypto');
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * SHA256 helper
 */
function sha256(input) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Pad number to 2 digits
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

module.exports = {
  createSeededRNG,
  PLANETS,
  EXTRAS,
  generateHash,
  sha256,
  pad2
};

