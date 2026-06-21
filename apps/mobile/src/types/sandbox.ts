/** Journey types matching web ENTRY_CARDS. */
export type SandboxJourneyType = 'solo' | 'pair' | 'whatif' | 'group';

/** Slot population / entry modes (aligned with web slotWirePopulationKind + entry chooser). */
export type SlotEntryMode =
  | 'chart_id'
  | 'ephemeris_birth'
  | 'blank_canvas'
  | 'empty'
  | 'birth_incomplete'
  | 'invalid';

export interface SandboxSlotSnapshot {
  planets: Array<{ name: string; lon: number }>;
  houses: number[];
  aspects: Array<{ bodyA: string; bodyB: string; type: string; orb: number }>;
}

export interface SandboxSlot {
  index: number;
  entryMode: SlotEntryMode;
  chartId?: string;
  chartDisplayName?: string;
  snapshot?: SandboxSlotSnapshot;
  baseSnapshot?: SandboxSlotSnapshot;
  freeBuildAscDeg?: number;
  birth?: {
    date: string;
    time: string;
    lat: number;
    lon: number;
    timezone: string;
    locationLabel?: string;
    houseSystem?: string;
  };
  overrides?: Record<string, { lon: number }>;
}

export type SandboxResolveReport = {
  explanation?: {
    spec?: string;
    sections?: Array<{ id: string; title: string; text: string; bullets?: string[] }>;
  };
  sandboxSynastryReport?: {
    schema_version?: string;
    mode?: string;
    pairSections?: Array<{
      pairHeader?: string;
      sourceSlotIndex?: number;
      targetSlotIndex?: number;
      tierBlocks?: Array<{
        tierId?: string;
        title?: string;
        activations?: Array<{
          aspectKey?: string;
          directionalHeader?: string;
          synastryProse?: string;
          sonicInterplay?: string;
        }>;
      }>;
    }>;
  };
  seed?: string;
  meta?: { combinedHash?: string; canonical_object_hash?: string };
};

/** GET /api/sandbox/compositions list row (engine SELECT list fields). */
export interface SavedComposition {
  id: string;
  sandbox_state: unknown;
  vector_hash: string;
  seed: string;
  plan_hash: string;
  provider: string | null;
  provider_version: string | null;
  export_id: string | null;
  source: string | null;
  composition_type: string | null;
  object_identity_hash: string | null;
  display_label: string | null;
  created_at: string;
}

/**
 * GET /api/sandbox/compositions/:id — full row (`SELECT * FROM astradio_sandbox_compositions`).
 * Matches server/index.js POST insert + GET by id.
 */
export interface SavedCompositionDetail {
  id: string;
  owner_user_id: string;
  sandbox_state: unknown;
  vector_hash: string;
  seed: string;
  plan_hash: string;
  report: unknown;
  provider: string | null;
  provider_version: string | null;
  export_id: string | null;
  source: string | null;
  composition_type: string | null;
  object_identity_hash: string | null;
  display_label: string | null;
  created_at: string;
  updated_at: string;
}

export type SandboxSurfaceState = 'ready_builder' | 'loading_base' | 'ready_report' | 'error';

export type ChartSearchResult = {
  chart_id: string;
  user_id: string;
  display_name: string | null;
  handle: string | null;
  birth_date: string;
  birth_time: string | null;
  label: string;
  source: 'own' | 'connection';
};
