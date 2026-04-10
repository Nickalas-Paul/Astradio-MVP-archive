/**
 * Text Explainer Contracts v1.0
 * Deterministic text generation from control-surface payload
 */

export interface ExplainerAtoms {
  arc_desc: string;
  movement: string;
  rhythm_feel: string;
  density_desc: string;
  motif_desc: string;
  astro_color: string;
  /** V1-B: Psychology-tone line (element blend + tension). */
  psych_tone?: string;
  /** V1-B: Motion/gravity/flow/shimmer summary. */
  motion_profile_line?: string;
  /** V1-B: Three short lines for Encounter / Recognition / Integration. */
  phase_story_lines?: [string, string, string];
  /** V1-B: "Tempo sits in ___, density is ___, register leans ___". */
  music_facts_line?: string;
  /** V1-B: When gates fail, class of failure (no raw numbers). */
  gate_line?: string;
}

/** Optional inputs for explainer alignment (real snapshot-derived astro + plan/guidance). */
export interface ExplainerInputs {
  astro?: AstroSummary;
  featureVec?: import('../contracts').FeatureVec;
  plan?: import('../contracts').Plan;
}

export interface TextExplainer {
  short: string;
  long: string;
  bullets: string[];
  atoms: ExplainerAtoms;
  template_id: string;
  seed: string;
}

export interface ControlSurfacePayload {
  // From student v2.3 predictions (Unified Spec v1.1)
  arc_shape: number; // 0-1, renamed from arc_curve for v1.1
  density_level: number; // 0-1
  tempo_norm: number; // 0-1
  step_bias: number; // 0-1
  leap_cap: number; // 1-6
  rhythm_template_id: number; // 0-7
  syncopation_bias: number; // 0-1
  motif_rate: number; // 0-1
  element_dominance: string; // "fire" | "earth" | "air" | "water"
  aspect_tension: number; // 0-1
  modality: string; // "cardinal" | "fixed" | "mutable"
  
  // Genre scaffolding (default "house")
  genre?: string; // "house" | "classical" | "jazz" | "ambient" | "electronic"
  
  // Hash for deterministic variation (seed = controls.hash)
  hash: string;
}

export interface AstroSummary {
  elements: {
    fire: number;
    earth: number;
    air: number;
    water: number;
  }; // 0-1, totals ~1
  dominant_planets: string[]; // e.g., ["Mars", "Venus"]
  modality: {
    cardinal: number;
    fixed: number;
    mutable: number;
  };
  notable_aspects?: string[]; // short codes, e.g., "Venus△Mars"
  ts: string; // ISO timestamp
}

export interface GateReport {
  calibrated: {
    melody_arc: boolean;
    melody_step_leap: boolean;
    melody_narrative: boolean;
    rhythm_diversity: boolean;
    overall: boolean;
  };
  strict: {
    melody_arc: boolean;
    melody_step_leap: boolean;
    melody_narrative: boolean;
    rhythm_diversity: boolean;
    overall: boolean;
  };
  scores: {
    melody_arc: number;
    melody_step_leap: number;
    melody_narrative: number;
    rhythm_diversity: number;
  };
  latency_ms: {
    predict: number;
    plan: number;
    total: number;
  };
}

export interface ComposeResponse {
  controls: ControlSurfacePayload;
  astro: {
    element_dominance: string;
    aspect_tension: number;
    modality: string;
  };
  gate_report: GateReport;
  audio: {
    url: string;
    latency_ms: number;
  };
  text: TextExplainer;
  artifacts: {
    model: string;
    encoder: string;
    snapset: string;
    gate: string;
    mapping_tables_version: string;
    timestamp: string;
    midi?: {
      base64: string;
      sha256: string;
      ppq: number;
      tracks: number;
      bytes: number;
    };
  };
  plan?: import('../contracts').Plan; // Optional: returned when audio_export_available is false or includePlan=1
  hashes: {
    control: string;
    audio: string;
    explanation: string;
    plan_sha256: string; // Always present
    midi_sha256?: string; // Present when MIDI is included
  } & { [key: string]: string | null | undefined }; // Allow dynamic hash fields
}

export interface ComposeRequest {
  mode: "sky" | "overlay" | "sandbox";
  skyParams?: {
    latitude: number;
    longitude: number;
    /** Local calendar wall time as YYYY-MM-DDTHH:mm[:ss] (suffix Z optional; chart-snapshot uses `timezone` when set). */
    datetime: string;
    /** IANA zone for date+time — same as canonical location / Profile / Campaign transit (explicit → no tzlookup). */
    timezone?: string;
  };
  overlayParams?: {
    natalLatitude: number;
    natalLongitude: number;
    natalDatetime: string;
    /** When set, natal chart-snapshot uses this IANA zone (aligned with Campaign / transit fingerprint). */
    natalTimezone?: string;
    currentLatitude: number;
    currentLongitude: number;
    currentDatetime: string;
    /** When set, transit chart-snapshot uses this IANA zone (aligned with transitContextFingerprint). */
    currentTimezone?: string;
  };
  controls?: Partial<ControlSurfacePayload>; // For sandbox mode
  genre?: string;
  includePlan?: boolean | number; // Optional: request plan in response (default: auto when audio_export_available is false)
  includeMidi?: boolean | number; // Optional: request MIDI artifact in response
  /** Deterministic compose seed (optional). */
  seed?: string;
  /**
   * When true, run Lyria/export audio branch. When false or omitted, text/explanation still run; audio/export must not execute.
   * Omitted defaults to true only for empty-body sandbox fallback in compose (backward compat); callers should set explicitly.
   */
  generateAudio?: boolean;
  /** When generateAudio is true, if set, response must match these hashes (determinism gate for second-step audio). */
  expectedPlanSha256?: string;
  expectedObjectIdentityHash?: string;
  /** Sandbox resolve: projection variant only; same canonical pipeline. */
  output_kind?: "full" | "feed_card";
  /** Ephemeris snapshot from sandbox preview (validated server-side). */
  overriddenSnapshot?: import("../contracts").EphemerisSnapshot;
  /** Birth chart input when no overriddenSnapshot. */
  chartData?: { date: string; time: string; lat: number; lon: number };
  testOverride?: {
    forceFail?: string;
    calibrated?: boolean;
  };
}

export interface ExplainerConfig {
  style: "concise" | "poetic" | "technical";
  maxLength: {
    short: number;
    long: number;
  };
  failMode: "hints" | "silent" | "full";
  deterministic: boolean;
}

export interface ExplainerMetrics {
  atoms_generation_ms: number;
  realizer_ms: number;
  total_ms: number;
  template_id: string;
  atoms_count: number;
  adjectives_used: string[];
  gate_status: "pass" | "fail";
  fail_reason?: string;
}

export interface MappingTable {
  version: string;
  // Arc descriptions with selectable templates
  arc_descriptions: Record<string, {
    phrases: string[];
    intensity: number;
    templates?: string[];
  }>;
  // Movement descriptions with primary phrase sets
  movement_descriptions: Record<string, {
    phrases: string[];
    step_ratio: number;
    primary?: string;
  }>;
  // Rhythm classes used by template_id buckets
  rhythm_classes: Record<string, { class: string }>;
  // Syncopation descriptors
  syncopation_descriptions: Record<string, { description: string }>;
  // Density descriptors including optional stellium suffix
  density_descriptions: Record<string, {
    phrases?: string[];
    density_level?: number;
    description?: string;
    stellium_suffix?: { suffix: string };
  }>;
  motif_descriptions: Record<string, {
    phrases?: string[];
    motif_rate?: number;
    description?: string;
  }>;
  // Astro color adjectives and planet adjectives
  astro_colors: {
    element_adjectives: Record<string, string>;
    planet_adjectives: Record<string, string>;
  };
  // Optional planet tints used in movement/rhythm
  planet_tints?: Record<string, string>;
  // Leap modifiers used with leap_cap
  leap_modifiers?: Record<string, { modifier: string }>;
  // Element tint phrases
  element_tints: Record<string, { phrase: string }> & { none: { phrase: string } };
  // Template structures for text lengths
  template_structures: {
    short: { max_length: number };
    long: { max_length: number };
  };
  // Tempo descriptions for long text fragments
  tempo_descriptions?: Record<string, { description: string }>;
  // Sandbox hints by gate key
  sandbox_hints?: Record<string, { hint: string }>;
  // Legacy fields kept for compatibility
  aspect_influences?: Record<string, { phrases: string[]; aspect: string }>;
  template_styles?: Record<string, { template: string; max_length: number }>;
  fail_hints?: Record<string, Record<string, string>>;
  synonym_variations: {
    seed_based: { sets: Array<Record<string, string>> }
  };
}

export interface ExplainerContext {
  mode: "sky" | "overlay" | "sandbox";
  user_preferences?: {
    style: "concise" | "poetic" | "technical";
    complexity: "simple" | "moderate" | "detailed";
  };
  session_id: string;
  request_id: string;
}

export interface OverlayContext {
  natal_controls: ControlSurfacePayload;
  current_controls: ControlSurfacePayload;
  delta_controls: Partial<ControlSurfacePayload>;
  contrast_description: string;
}

export interface SandboxContext {
  user_controls: Partial<ControlSurfacePayload>;
  default_controls: ControlSurfacePayload;
  failed_gates: string[];
  suggestions: string[];
}
