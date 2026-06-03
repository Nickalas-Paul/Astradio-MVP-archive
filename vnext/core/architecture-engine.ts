/**
 * Architecture Engine - Canonical Transformation Pipeline
 * 
 * Single entry point for:
 * Birth Data → EphemerisSnapshot → FeatureVec (64) → PersonalityProfileV1 → AstroProfile → Guidance
 * 
 * No new transformation logic. Only orchestration of existing functions.
 */

import type { EphemerisSnapshot, FeatureVec } from '../contracts';
import { encodeFeatures } from '../feature-encode';
import { guidanceFromFeatures } from '../astro/guidance';
import { buildAstroProfile, type AstroProfile } from '../astro/profile-from-snapshot';
import { buildRelationalChartContext, type RelationalChartContext } from '../report-context';

export interface ChartInput {
  date: string;
  time: string;
  lat: number;
  lon: number;
  /** IANA zone; when set, /api/chart-snapshot interprets date+time in this zone. */
  timezone?: string;
  /** placidus | equal | koch — passed to chart-snapshot when set. */
  houseSystem?: string;
}

export interface ArchitectureOutput {
  snapshot: EphemerisSnapshot;
  features: FeatureVec;
  personality: import('../astro/personality-profile').PersonalityProfileV1;
  astroProfile: AstroProfile;
  guidance: import('../astro/guidance').AstroGuidance & {
    elementBlend: import('../astro/guidance').ElementBlend;
    motionProfile: import('../astro/guidance').MotionProfile;
    narrativeArc: import('../astro/guidance').NarrativeArc;
    personality: import('../astro/personality-profile').PersonalityProfileV1;
  };
  /** Relational chart context: bodies, aspects, top-ranked aspects for reporting. */
  relationalContext: RelationalChartContext;
  seed: string;
}

/**
 * Fetch EphemerisSnapshot from /api/chart-snapshot.
 * Exported for request-local use (e.g. comparison: fetch once per chart, then generateArchitectureFromSnapshot).
 */
export async function fetchChartSnapshot(input: ChartInput): Promise<EphemerisSnapshot> {
  const PORT = process.env.PORT || '4000';
  const base = process.env.API_BASE_URL || `http://localhost:${PORT}`;
  const { date, time, lat, lon, timezone, houseSystem } = input;
  const timeStr = time.length === 5 ? time : time.slice(0, 5);
  const q = new URLSearchParams({ date, time: timeStr, lat: String(lat), lon: String(lon) });
  const tz = timezone && String(timezone).trim();
  if (tz) q.set('timezone', tz);
  const hs = houseSystem && String(houseSystem).trim();
  if (hs) q.set('houseSystem', hs);
  const extra: Record<string, string> = {};
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass && typeof bypass === 'string' && bypass.trim()) {
    extra['x-vercel-protection-bypass'] = bypass.trim();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { engineInternalFetchHeaders } = require('../../lib/engine-internal-fetch-headers') as {
    engineInternalFetchHeaders: (e?: Record<string, string>) => Record<string, string>;
  };
  const r = await fetch(`${base}/api/chart-snapshot?${q}`, {
    headers: engineInternalFetchHeaders(extra),
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const msg =
      (typeof data.error === 'string' && data.error) ||
      `chart-snapshot failed: ${r.status} ${r.statusText}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return data as EphemerisSnapshot;
}

/**
 * Generate architecture output from chart input.
 * 
 * This is the ONLY canonical way to derive:
 * - snapshot
 * - feature vector
 * - personality profile
 * - astro profile
 * - guidance
 * 
 * All existing systems should consume this output rather than computing these independently.
 * 
 * @param input Chart input (date, time, lat, lon)
 * @param seed Optional seed string (defaults to hash of input). Used for deterministic personality computation.
 * @returns ArchitectureOutput with all derived data
 */
export async function generateArchitecture(
  input: ChartInput,
  seed?: string
): Promise<ArchitectureOutput> {
  // Step 1: Fetch snapshot (or accept if already provided)
  const snapshot = await fetchChartSnapshot(input);

  // Step 2: Encode features (existing function, no changes)
  const features = encodeFeatures(snapshot) as FeatureVec;

  // Step 3: Generate seed if not provided (deterministic hash of input)
  const finalSeed = seed || generateSeedFromInput(input);

  // Step 4: Compute guidance (includes personality via guidanceFromFeatures)
  const guidance = guidanceFromFeatures(features, snapshot, finalSeed);

  // Step 5: Extract personality from guidance (already computed)
  const personality = guidance.personality;

  // Step 6: Build astro profile (existing function, no changes)
  const astroProfile = buildAstroProfile(snapshot);

  // Step 7: Build relational context for reporting (bodies, aspects, top-ranked)
  const relationalContext = buildRelationalChartContext(snapshot);

  return {
    snapshot,
    features,
    personality,
    astroProfile,
    guidance,
    relationalContext,
    seed: finalSeed
  };
}

/**
 * Generate architecture output from existing snapshot.
 * Useful when snapshot is already available (e.g., from cache).
 */
export async function generateArchitectureFromSnapshot(
  snapshot: EphemerisSnapshot,
  seed?: string
): Promise<ArchitectureOutput> {
  // Step 1: Encode features
  const features = encodeFeatures(snapshot) as FeatureVec;

  // Step 2: Generate seed if not provided
  const finalSeed = seed || generateSeedFromSnapshot(snapshot);

  // Step 3: Compute guidance (includes personality)
  const guidance = guidanceFromFeatures(features, snapshot, finalSeed);

  // Step 4: Extract personality
  const personality = guidance.personality;

  // Step 5: Build astro profile
  const astroProfile = buildAstroProfile(snapshot);

  // Step 6: Build relational context for reporting
  const relationalContext = buildRelationalChartContext(snapshot);

  return {
    snapshot,
    features,
    personality,
    astroProfile,
    guidance,
    relationalContext,
    seed: finalSeed
  };
}

/**
 * Generate deterministic seed from chart input.
 */
function generateSeedFromInput(input: ChartInput): string {
  const str = `${input.date}|${input.time}|${input.lat}|${input.lon}`;
  return hashString(str);
}

/**
 * Generate deterministic seed from snapshot.
 */
function generateSeedFromSnapshot(snapshot: EphemerisSnapshot): string {
  const str = `${snapshot.ts}|${snapshot.lat}|${snapshot.lon}`;
  return hashString(str);
}

/**
 * Simple hash function for seed generation.
 */
function hashString(str: string): string {
  // Use Node.js crypto if available
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 16);
  } catch {
    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).slice(0, 16);
  }
}
