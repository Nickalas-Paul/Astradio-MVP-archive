// vnext/rpg/contracts.ts
// Core deterministic contracts for the RPG projection layer.

import type { EphemerisSnapshot } from '../contracts';

// Seed and hash type aliases (opaque string brands)
export type SnapshotHash = string & { readonly __brand: 'SnapshotHash' };
export type TransitHash = SnapshotHash & { readonly __brand_transit: 'TransitHash' };
export type StateHash = string & { readonly __brand: 'StateHash' };
export type TurnSeed = string & { readonly __brand: 'TurnSeed' };
export type AudioSeed = string & { readonly __brand: 'AudioSeed' };

export type RpgMapVersion = string & { readonly __brand: 'RpgMapVersion' };
export type RpgAlgoVersion = string & { readonly __brand: 'RpgAlgoVersion' };
export type AudioAlgoVersion = string & { readonly __brand: 'AudioAlgoVersion' };

export type RpgAudioProvider = 'none' | 'lyria' | 'local_wav';
export type RpgAudioStatus = 'pending' | 'ready' | 'failed';

export type BodyId =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'ceres'
  | 'pallas'
  | 'juno'
  | 'vesta'
  | 'chiron';

export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export interface RPGTransitSignal {
  signal_id: string;
  body: BodyId;
  otherBody?: BodyId;
  aspect?: AspectType;
  orb?: number;
  house?: number;
  tensionScore: number;
  supportScore: number;
  weight: number;
  tags: string[];
}

export interface RPGDomainScore {
  domain: string;
  score: number;
  normalizedScore: number;
  contributingSignals: string[];
}

export interface RPGBundleMetadata {
  rpg_map_version: RpgMapVersion;
  rpg_algo_version: RpgAlgoVersion;
  audio_algo_version: AudioAlgoVersion;
  natal_snapshot_hash: SnapshotHash;
  bundle_hash: string;
}

export interface RPGBodyPlacementEffect {
  body: BodyId;
  sign: string;
  house: number;
  domains: string[];
  primaryRole: string;
  modifiers: Record<string, number>;
}

export interface RPGAspectEffect {
  a: BodyId;
  b: BodyId;
  aspect: AspectType;
  orb: number;
  domains: string[];
  tensionWeight: number;
}

export interface RPGEffectsBundle {
  metadata: RPGBundleMetadata;
  classSlug: string;
  subclassSlug: string;
  risingModifierSlug: string;
  placements: RPGBodyPlacementEffect[];
  aspects: RPGAspectEffect[];
  domainSummary: RPGDomainScore[];
  /** Phase 1 mechanical stats (rpg-v2+). Optional for backward-compat reads of rpg-v1 rows. */
  statBlock?: {
    vitality: number;
    resilience: number;
    cunning: number;
    charm: number;
    intuition: number;
    willpower: number;
  };
  /** Phase 1 derivation trace (rpg-v2+). Opaque structured provenance. */
  statTrace?: unknown;
}

