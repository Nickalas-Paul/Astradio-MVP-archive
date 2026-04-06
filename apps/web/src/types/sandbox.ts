/**
 * Phase 4B — Sandbox frontend types.
 * Frontend contract; Next API adapts to backend SandboxDraft contract.
 */

import type { CanonicalLocation } from './location';

/** Phase 8H: canonical body set (core 10 + Chiron, Ceres, Pallas, Juno, Vesta). */
export type PlanetKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
  | 'chiron' | 'ceres' | 'pallas' | 'juno' | 'vesta';

export type SandboxBirth = {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: CanonicalLocation;
  houseSystem?: string;
};

export type SandboxOverrides = {
  planets: Partial<Record<PlanetKey, { lonDeg: number }>>;
  angles?: {
    ascDeg?: number;
    mcDeg?: number;
  };
};

export type EphemerisSnapshot = {
  ts: string;
  tz: string;
  lat: number;
  lon: number;
  houseSystem: string;
  planets: Array<{ name: string; lon: number; lat?: number; speed?: number }>;
  houses: [number, number, number, number, number, number, number, number, number, number, number, number];
  aspects: Array<{
    bodyA: string;
    bodyB: string;
    type: 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
    orb: number;
    exactAngle?: number;
    dynamics?: string;
    strength?: number;
    exactness?: number;
    priorityBase?: number;
    motion?: 'applying' | 'separating';
  }>;
  moonPhase: number;
  dominantElements: { fire: number; earth: number; air: number; water: number };
};

/** Snapshot route meta; aligns with engine `vnext/api/sandbox-routes` snapshot response. */
export type SandboxSnapshotMeta = {
  preview_only?: boolean;
  birthHash?: string;
  overridesHash?: string;
  combinedHash?: string;
  canonical_input_hash_version?: number;
};

/** One slot in the wire body for POST /api/sandbox/resolve (BFF normalizes nested birth). */
export type SandboxCompositionSlotWire = {
  chart_id?: string;
  ephemeris_birth?: SandboxBirth;
  overrides?: SandboxOverrides;
};

/** Resolve-bound fields; matches SandboxCompositionInputV1 subset used by the Sandbox page today. */
export type SandboxCompositionInputState = {
  schema_version: string;
  slots: SandboxCompositionSlotWire[];
  active_slot_index: number;
  compose_controls: Record<string, number>;
  output_kind: 'full' | 'feed_card';
  seed?: string;
  transit_context?: Record<string, unknown>;
  binding?: Record<string, unknown>;
};

/** Outcome of the last successful resolve (authoritative artifact line; separate from preview). */
export type SandboxResolvedSession = {
  fullResponse: Record<string, unknown>;
  /** Exact JSON object last POSTed to /api/sandbox/resolve for this session (replay). */
  lastSubmittedResolveBody: Record<string, unknown>;
  snapshotUsed: EphemerisSnapshot;
  combinedHashUsed: string;
  planSha256: string | null;
  canonicalSlotOrder: string[] | null;
  canonicalInputHash: string | null;
  canonicalObjectHash: string | null;
  report: SandboxReport;
  exportId: string | null;
  lastComposeProvider: string | null;
  exportUnavailableReason: { summary: string; step?: string; message?: string } | null;
};

export type SandboxReportExplanation = {
  spec: string;
  sections: Array<{ id: string; title: string; text: string; bullets?: string[] }>;
};

export type SandboxReport = {
  features: number[];
  personality: any;
  guidance: any;
  explanation: SandboxReportExplanation;
  seed: string;
  meta: {
    combinedHash: string;
    data_classification?: {
      explanation: string;
      features_personality_guidance: string;
    };
    canonical_object_hash?: string;
  };
};
