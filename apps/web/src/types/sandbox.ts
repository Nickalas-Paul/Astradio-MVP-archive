/**
 * Phase 4B — Sandbox frontend types.
 * Frontend contract; Next API adapts to backend SandboxDraft contract.
 */

import type { CanonicalLocation } from './location';

/** Phase 8H: canonical body set (core 10 + Chiron, Ceres, Pallas, Juno, Vesta). */
export type PlanetKey =
  | 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
  | 'northNode'
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

/** Path A = blank canvas (silent transit base); Path B = birth data first. chart_id slots are implicit Path B. */
export type SandboxSlotEntryMode = 'blank_canvas' | 'birth_data';

/** One slot in the wire body for POST /api/sandbox/resolve (BFF normalizes nested birth). */
export type SandboxCompositionSlotWire = {
  chart_id?: string;
  /** UI-only label from chart owner (not sent to resolve). */
  chart_display_name?: string;
  /** Free-build only: rotates equal-house cusps on the wheel (not sent to snapshot/resolve). */
  free_build_asc_deg?: number;
  /** null/absent = no workflow choice yet; blank_canvas | birth_data set in Commit 2 UI. */
  entry_mode?: SandboxSlotEntryMode | null;
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
  /** When true, next resolve may run computeCompatibilitySystem for two-chart_id pair aggregates. */
  commit_relational_classification?: boolean;
  transit_context?: Record<string, unknown>;
  binding?: Record<string, unknown>;
};

/** Successful resolve through the canonical pipeline; holds replay body. */
export type SandboxLiveResolveSession = {
  source: 'live_resolve';
  fullResponse: Record<string, unknown>;
  /** Exact JSON object last POSTed to /api/sandbox/resolve for this session (replay). */
  lastSubmittedResolveBody: Record<string, unknown>;
  /** Null after load when preview was not reconstructed (e.g. empty active slot); replay does not require this. */
  snapshotUsed: EphemerisSnapshot | null;
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

/** Artifacts rehydrated from a saved row; replay body absent until a new resolve. */
export type SandboxLoadedRowSession = {
  source: 'loaded_row';
  report: SandboxReport | null;
  planSha256: string | null;
  exportId: string | null;
  combinedHashUsed: string | null;
  lastSubmittedResolveBody: null;
};

/** Unified resolve / saved-row display line (never preview). */
export type SandboxResolvedSession = SandboxLiveResolveSession | SandboxLoadedRowSession;

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
