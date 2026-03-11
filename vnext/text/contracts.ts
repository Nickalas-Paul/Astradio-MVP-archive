import type { EphemerisSnapshot, SnapshotAspect } from '../contracts';
import type { RelationalChartContext } from '../report-context';

export type TextSurface =
  | 'daily'
  | 'compat'
  | 'group'
  | 'sandboxDiff'
  | 'campaignTurn'
  | 'characterSheet';

export type TextAlgoVersion = 'vnext-text-1';

export type ToneId =
  | 'daily.personality.v1'
  | 'compat.personality.v1'
  | 'group.personality.v1'
  | 'sandboxDiff.personality.v1'
  | 'campaignTurn.personality.v1'
  | 'characterSheet.personality.v1';

export type MissingnessKind =
  | 'no_houses'
  | 'no_aspects'
  | 'no_minor_bodies'
  | 'no_natal_context'
  | 'unsupported_surface'
  | 'internal_error';

export interface MissingnessItem {
  kind: MissingnessKind;
  detail?: string;
}

/**
 * Canonical text-engine input. Snapshot is the single source of truth;
 * relationalContext is a derived helper only.
 */
export interface ChartTextInput {
  snapshot: EphemerisSnapshot;
  relationalContext?: RelationalChartContext;
  surface: TextSurface;
  algoVersion: TextAlgoVersion;
  toneVersion: ToneId;
  hasHouses: boolean;
  hasAspects: boolean;
  hasNatalContext: boolean;
  missing: MissingnessItem[];
}

export interface BodyRegistryEntry {
  key: string;
  name: string;
  isMajor: boolean;
}

export interface BodyRegistry {
  all: BodyRegistryEntry[];
  majors: BodyRegistryEntry[];
  minors: BodyRegistryEntry[];
}

export interface AstroPlacementFact {
  id: string;
  body: string;
  sign: string;
  house: number | null;
  nearAngle: 'ASC' | 'MC' | 'IC' | 'DSC' | null;
}

export interface AstroHouseEmphasis {
  house: number;
  weight: number;
}

export interface AstroAspectFact {
  id: string;
  aspect: SnapshotAspect;
  ranking: {
    /**
     * Primary deterministic priority from aspect-priority.ts (higher = earlier).
     */
    priorityBase: number;
    strength: number;
    exactness: number;
    orderIndex: number;
  };
}

export interface AstroFacts {
  placements: AstroPlacementFact[];
  houses: AstroHouseEmphasis[];
  aspects: AstroAspectFact[];
  bodyRegistry: BodyRegistry;
}

export interface AnalysisNodeCitation {
  /**
   * IDs of placement or aspect facts used to support this node.
   */
  factIds: string[];
}

export interface AnalysisTheme {
  id: string;
  label: string;
  weight: number;
  citations: AnalysisNodeCitation;
}

export interface AnalysisTension {
  id: string;
  label: string;
  weight: number;
  polarity: 'support' | 'mixed' | 'tension';
  citations: AnalysisNodeCitation;
}

export interface AnalysisOpportunity {
  id: string;
  label: string;
  weight: number;
  citations: AnalysisNodeCitation;
}

export interface MusicMapping {
  /**
   * Optional high-level mapping from chart dynamics into musical traits.
   * Only populated where the existing system already exposes this linkage.
   */
  traits?: {
    tempo?: string;
    density?: string;
    register?: string;
    motion?: string;
    harmonicPosture?: string;
  };
}

export interface AnalysisConfidence {
  score: number;
  missing: MissingnessItem[];
}

export interface TextAnalysisIntermediate {
  surface: TextSurface;
  algoVersion: TextAlgoVersion;
  toneVersion: ToneId;
  /** True when this analysis is anchored in a specific natal or natal-overlay context. */
  hasNatalContext: boolean;
  astro_facts: AstroFacts;
  themes: AnalysisTheme[];
  tensions: AnalysisTension[];
  opportunities: AnalysisOpportunity[];
  music_mapping?: MusicMapping;
  confidence: AnalysisConfidence;
}

export interface ToneSectionSpec {
  id: string;
  title: string;
}

export interface ToneSpec {
  tone_name: string;
  sentence_length_range: { min: number; max: number };
  rhetorical_style: 'reflective_personality_psychology';
  allowed_devices: string[];
  forbidden_phrases: string[];
  pronoun_policy: 'second_person_reflective';
  metaphor_intensity: 'low' | 'medium';
  section_structure: ToneSectionSpec[];
}

