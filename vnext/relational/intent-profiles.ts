/**
 * Phase 5 — Intent profiles loader.
 * Read-only config. Deterministic. No DB writes. Fail-closed on missing or invalid profile.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const REQUIRED_FACET_KEYS = ['overall', 'elemental', 'tension', 'preference'] as const;
const WEIGHT_SUM_EPSILON = 1e-6;
const TIE_BREAK_RULE = 'score_desc_vectorhash_asc_chartid_asc';

export interface IntentProfile {
  id: string;
  slug: string;
  label: string;
  version: string;
  algorithm_version: string;
  facet_weights: {
    overall: number;
    elemental: number;
    tension: number;
    preference: number;
  };
  tie_break_rule: string;
  profile_hash: string;
}

interface RawProfile {
  id?: string;
  slug?: string;
  label?: string;
  version?: string;
  algorithm_version?: string;
  facet_weights?: Record<string, unknown>;
  tie_break_rule?: string;
}

function canonicalJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((k) => {
    const v = obj[k];
    const vStr =
      v !== null && typeof v === 'object' && !Array.isArray(v)
        ? canonicalJson(v as Record<string, unknown>)
        : JSON.stringify(v);
    return `"${k}":${vStr}`;
  });
  return `{${pairs.join(',')}}`;
}

function sha256Hex(str: string): string {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function loadRawProfiles(): RawProfile[] {
  const configPath = path.resolve(__dirname, 'config', 'intent-profiles.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('intent-profiles.json must be an array');
  }
  return parsed as RawProfile[];
}

function validateAndTransform(raw: RawProfile, index: number): IntentProfile {
  if (!raw.id || typeof raw.id !== 'string' || !raw.id.trim()) {
    throw new Error(`Profile at index ${index}: id is required and must be a non-empty string`);
  }
  if (!raw.slug || typeof raw.slug !== 'string' || !raw.slug.trim()) {
    throw new Error(`Profile at index ${index}: slug is required and must be a non-empty string`);
  }
  if (!raw.label || typeof raw.label !== 'string') {
    throw new Error(`Profile at index ${index}: label is required`);
  }
  if (!raw.version || typeof raw.version !== 'string') {
    throw new Error(`Profile at index ${index}: version is required`);
  }
  if (!raw.algorithm_version || typeof raw.algorithm_version !== 'string') {
    throw new Error(`Profile at index ${index}: algorithm_version is required`);
  }
  if (!raw.tie_break_rule || raw.tie_break_rule !== TIE_BREAK_RULE) {
    throw new Error(
      `Profile at index ${index}: tie_break_rule must be "${TIE_BREAK_RULE}"`
    );
  }

  const fw = raw.facet_weights;
  if (!fw || typeof fw !== 'object') {
    throw new Error(`Profile at index ${index}: facet_weights is required and must be an object`);
  }

  const facetKeys = Object.keys(fw).sort();
  const requiredSet = new Set(REQUIRED_FACET_KEYS);
  const actualSet = new Set(facetKeys);
  if (facetKeys.length !== REQUIRED_FACET_KEYS.length || !facetKeys.every((k) => requiredSet.has(k as typeof REQUIRED_FACET_KEYS[number]))) {
    throw new Error(
      `Profile at index ${index}: facet_weights must have exactly keys: ${REQUIRED_FACET_KEYS.join(', ')}`
    );
  }

  const weights: Record<string, number> = {};
  let sum = 0;
  for (const k of REQUIRED_FACET_KEYS) {
    const v = fw[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Profile at index ${index}: facet_weights.${k} must be a finite number`);
    }
    weights[k] = v;
    sum += v;
  }
  if (Math.abs(sum - 1) > WEIGHT_SUM_EPSILON) {
    throw new Error(`Profile at index ${index}: facet_weights must sum to 1.0 (got ${sum})`);
  }

  const profileForHash = {
    id: raw.id,
    slug: raw.slug,
    label: raw.label,
    version: raw.version,
    algorithm_version: raw.algorithm_version,
    facet_weights: weights,
    tie_break_rule: raw.tie_break_rule,
  };
  const profile_hash = sha256Hex(canonicalJson(profileForHash as unknown as Record<string, unknown>));

  return {
    id: raw.id,
    slug: raw.slug,
    label: raw.label,
    version: raw.version,
    algorithm_version: raw.algorithm_version,
    facet_weights: weights as IntentProfile['facet_weights'],
    tie_break_rule: raw.tie_break_rule,
    profile_hash,
  };
}

let cached: IntentProfile[] | null = null;

function loadProfiles(): IntentProfile[] {
  if (cached) return cached;
  const raw = loadRawProfiles();
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();
  const result: IntentProfile[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = validateAndTransform(raw[i], i);
    if (seenIds.has(p.id)) {
      throw new Error(`Duplicate profile id: ${p.id}`);
    }
    if (seenSlugs.has(p.slug)) {
      throw new Error(`Duplicate profile slug: ${p.slug}`);
    }
    seenIds.add(p.id);
    seenSlugs.add(p.slug);
    result.push(p);
  }
  cached = result;
  return result;
}

export function listIntentProfiles(): IntentProfile[] {
  return loadProfiles().slice();
}

export function getIntentProfileById(id: string): IntentProfile {
  const profiles = loadProfiles();
  const found = profiles.find((p) => p.id === id);
  if (!found) {
    throw new Error(`Intent profile not found: id=${id}`);
  }
  return found;
}

export function getIntentProfileBySlug(slug: string): IntentProfile {
  const profiles = loadProfiles();
  const found = profiles.find((p) => p.slug === slug);
  if (!found) {
    throw new Error(`Intent profile not found: slug=${slug}`);
  }
  return found;
}
